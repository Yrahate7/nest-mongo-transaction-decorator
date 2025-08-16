import { Module } from "@nestjs/common";
import {
	TransactionInstance,
	TransactionInterceptor,
	TransactionParam,
	TransactionsTemplate,
} from "./mongoose-transaction-decorator.service";

@Module({
	providers: [],
	exports: [TransactionInterceptor, TransactionParam, TransactionsTemplate, TransactionInstance],
})
export class MongooseTransactionDecoratorModule {}
