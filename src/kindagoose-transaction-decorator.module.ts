import { Module } from "@nestjs/common";
import {
	TransactionInstance,
	TransactionInterceptor,
	TransactionParam,
	TransactionsTemplate,
} from "./kindagoose-transaction-decorator.service";

@Module({
	providers: [],
	exports: [TransactionInterceptor, TransactionParam, TransactionsTemplate, TransactionInstance],
})
export class KindagooseTransactionDecoratorModule {}
