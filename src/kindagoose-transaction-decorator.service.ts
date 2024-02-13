import {
	BadRequestException,
	CallHandler,
	ExecutionContext,
	HttpException,
	Inject,
	Injectable,
	InternalServerErrorException,
	Logger,
	NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, of, tap, throwError } from "rxjs";
import { createParamDecorator } from "@nestjs/common";
import mongoose, { ClientSession, ClientSessionOptions, MongooseError, connections } from "mongoose";
import { isAxiosError } from "axios";
import { TypeGuardError } from "typia";
import { getConnectionToken } from "kindagoose";

export class TransactionsTemplate {
	sessionOptions?: ClientSessionOptions;
	name: string;

	constructor(name: string, sessionOptions: ClientSessionOptions = TransactionsTemplate.defaultSessionOptions) {
		this.name = name;
		this.sessionOptions = sessionOptions ?? TransactionsTemplate.defaultSessionOptions;
	}

	/**
	 * Default session options
	 * Mongo queries with this clientSession will ensure that data read is present in all replica set members,
	 * It will retry writes if they fail, Will read data from primary replicaset member,
	 * Will write data to majority of the replicaset members and ensure that it is written to disk,
	 * Will wait for 45 seconds (MAX) for write to complete,
	 * Will wait for 60 seconds (MAX) for all the queries using this session to complete
	 * @returns ClientSessionOptions
	 */
	public static readonly defaultSessionOptions: ClientSessionOptions = {
		defaultTransactionOptions: {
			readConcern: "majority",
			willRetryWrite: true,
			retryWrites: true,
			readPreference: "primary",
			writeConcern: { w: "majority", journal: true, wtimeoutMS: 45000 },
			maxTimeMS: 60000,
		},
	};

	/**
	 * Default session options for read only operations. Data returned by queries using this session might be stale data.
	 * Mongo queries with this clientSession will ensure that data read is present in all replica set members,
	 * It will read data from the nearest replicaset member,
	 * Will wait for 60 seconds (MAX) for all the queries using this session to complete
	 * @returns ClientSessionOptions
	 */
	public static readonly readOnlySessionOptions: ClientSessionOptions = {
		defaultTransactionOptions: {
			readConcern: "majority",
			readPreference: "nearest",
			maxTimeMS: 60000,
		},
	};
}

export class TransactionInstance extends TransactionsTemplate {
	session?: ClientSession | null; // WIll be initialized in the interceptor

	constructor(name: string, sessionOptions: ClientSessionOptions) {
		super(name, sessionOptions);
	}
}

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
	private readonly logger = new Logger(TransactionInterceptor.name);

	private readonly transactionsToBeGeneratedInInterceptor: TransactionInstance[] = [];

	constructor(
		@Inject(getConnectionToken())
		private readonly databaseGlobalConnection: mongoose.Connection
	) {
		// const transactionNames = transactions.map(transaction => transaction.name);
		// const duplicateNames = transactionNames.filter((name, index) => transactionNames.indexOf(name) !== index);
		// if (duplicateNames.length > 0) {
		// 	throw Error("Duplicate transaction names found in the interceptor");
		// }
		// this.transactionsToBeGeneratedInInterceptor = transactions;
	}

	private getConnection() {
		// TODO check on test environment
		if (!this.databaseGlobalConnection) {
			throw new Error("No connections found");
		}
		return this.databaseGlobalConnection;
	}
	/**
	 * Generate transactions for the request
	 * Does not generate transactions if the environment is test
	 * @returns TransactionInstance[]
	 */
	private async generateTransactions() {
		const transactionsArray: TransactionInstance[] = [];
		if (process.env.NODE_ENV === "test") {
			return transactionsArray;
		}

		if (this.transactionsToBeGeneratedInInterceptor.length === 0) {
			const dbTransaction: TransactionInstance = {
				session: null,
				sessionOptions: TransactionsTemplate.defaultSessionOptions,
				name: "default",
			};
			const session = await this.getConnection().startSession(dbTransaction.sessionOptions);
			session.startTransaction(dbTransaction.sessionOptions!.defaultTransactionOptions);
			dbTransaction.session = session;
			transactionsArray.push(dbTransaction);
		} else {
			for (const transaction of this.transactionsToBeGeneratedInInterceptor) {
				const session = await this.getConnection().startSession(transaction.sessionOptions);
				session.startTransaction(transaction.sessionOptions!.defaultTransactionOptions);
				transaction.session = session;
				transactionsArray.push(transaction);
			}
		}
		return transactionsArray;
	}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
		const httpContext = context.switchToHttp();
		const req = httpContext.getRequest();

		try {
			const transactions = await this.generateTransactions();
			req.transactions = transactions;
			req.isUsingTransaction = true;

			return next.handle().pipe(
				tap(async () => {
					await this.commitAllTransactions(transactions);
					await this.endAllSessions(transactions);
				}),
				catchError( e => this.handleTransactionExceptions(transactions,e)
				)
			);
		} catch (e) {
			return next
				.handle()
				.pipe(catchError(() => throwError(() => `Failed To Acquire Mongoose lock ${e.toString()}`)));
		}
	}

	private async commitAllTransactions(transactions: TransactionInstance[]) {
		const promiseMap = transactions.map(transaction => transaction.session!.commitTransaction());
		await Promise.allSettled(promiseMap).catch((commitError: Error) =>
			this.logger.error(`Could not commit transaction: ${commitError.toString()}`)
		);
	}

	private async handleTransactionExceptions(transactions: TransactionInstance[],e:any) {
		const promiseMap = transactions.map(transaction => transaction.session!.abortTransaction());
		await Promise.allSettled(promiseMap).catch((rollbackError: Error) =>
			this.logger.error(`Could not rollback transaction: ${rollbackError.toString()}`)
		);

		await this.endAllSessions(transactions);

		throw handleNestException(e);
	}

	private async endAllSessions(transactions: TransactionInstance[]) {
		const promiseMap = transactions.map(transaction => transaction.session!.endSession({}));
		return await Promise.allSettled(promiseMap).catch((endSessionError: Error) =>
			this.logger.error(`Could not release connection: ${endSessionError.toString()}`)
		);
	}
}

export const handleNestException = e => {
	if (e instanceof MongooseError) {
		return new InternalServerErrorException(e.message, {
			cause: e.message,
			description: e.stack,
		});
	} else if (isAxiosError(e)) {
		return new InternalServerErrorException(e.message, {
			cause: e.cause,
			description: e.stack,
		});
	} else if (e instanceof TypeGuardError) {
		return new BadRequestException(e.message, {
			cause: e,
			description: e.message,
		});
	} else {
		return e; // Nestjs will handle the error
	}
};
/**
 * TransactionParam decorator
 * If params are not provided, it returns the default transaction
 * Returns [ClientSession | null]
 */
export const TransactionParam = createParamDecorator((_data = "default", context) => {
	const httpContext = context.switchToHttp();
	const req = httpContext.getRequest();
	if (req.isUsingTransaction !== true) {
		throw new InternalServerErrorException(
			"TransactionParam can only be used with routes that have the TransactionInterceptor applied"
		);
	}
	return req.transactions?.find(transaction => transaction.name === _data)?.session || null;
});
