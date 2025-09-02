# NestJS Mongoose Transaction Management

This module provides a **transaction management system** for NestJS apps using **Mongoose**.  
It introduces an **interceptor–decorator pattern** to handle transactions automatically, reducing boilerplate and ensuring clean commit/rollback logic.

---

## 🚀 Features
- ✅ Automatic transaction start, commit, rollback, and cleanup  
- ✅ Multiple named transactions per request  
- ✅ Easy `@TransactionParam()` decorator to inject `ClientSession`  
- ✅ Configurable templates (`read-write`, `read-only`)  
- ✅ Test environment safe (skips sessions in `NODE_ENV=test`)  
- ✅ Centralized error handling (Mongoose + Axios wrapped in NestJS exceptions)  

---

## 📦 Installation
```bash
npm install mongoose @nestjs/mongoose


🧩 Components
1. TransactionsTemplate

Defines reusable transaction configurations.

// Read/Write default session options
TransactionsTemplate.defaultSessionOptions

// Read-only session options (faster, but may return stale data)
TransactionsTemplate.readOnlySessionOptions

2. TransactionInstance

Extends TransactionsTemplate, and attaches a ClientSession during runtime.

3. TransactionInterceptor

Starts transactions before controller logic runs

Commits transactions on success

Rolls back transactions on error

Ensures sessions are ended safely

Apply globally or per-controller:

import { UseInterceptors, Controller } from "@nestjs/common";

@Controller("users")
@UseInterceptors(TransactionInterceptor)
export class UsersController {}

4. TransactionParam Decorator

Injects a ClientSession into your route handler.

@Post()
async createUser(@TransactionParam() session: ClientSession) {
  const user = new this.userModel({ name: "Alice" });
  await user.save({ session });
  return user;
}


Supports multiple transactions by name:

@TransactionParam("analytics") analyticsSession: ClientSession

5. TransactionFactory

Attach multiple named transactions to a request.

@Controller("orders")
@UseInterceptors(
  new TransactionFactory([
    new TransactionsTemplate("default"),
    new TransactionsTemplate("analytics", TransactionsTemplate.readOnlySessionOptions),
  ]),
  TransactionInterceptor
)
export class OrderController {
  @Post()
  async createOrder(
    @TransactionParam("default") defaultSession: ClientSession,
    @TransactionParam("analytics") analyticsSession: ClientSession,
  ) {
    // Use both sessions in the same request
  }
}

⚡ Error Handling

Commit errors → logged, safe cleanup continues

Rollback errors → logged, safe cleanup continues

Axios & Mongoose errors → wrapped in InternalServerErrorException

All other errors → passed to NestJS default error handler

🧪 Testing

In NODE_ENV=test, no sessions are created.

You can still use @TransactionParam() safely, it will return null.

📖 Flow

TransactionFactory marks which transactions should be created

TransactionInterceptor initializes sessions

Controllers use @TransactionParam() to access sessions

On success → commits all transactions

On error → rolls back all transactions

Always ends sessions in finally

📌 Best Practices

Keep transactions short-lived

Avoid long-running async tasks inside transactions

Use TransactionFactory for multiple DB operations

Apply TransactionInterceptor only to routes that need DB writes


MIT License

Copyright (c) 2025 Yash Rahate

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
