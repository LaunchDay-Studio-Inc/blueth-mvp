import { registerHandler } from './registry';
import { eatMealHandler } from './eat-meal.handler';
import { sleepHandler } from './sleep.handler';
import { leisureHandler } from './leisure.handler';
import { socialCallHandler } from './social-call.handler';
import { workShiftHandler } from './work-shift.handler';
import { gigJobHandler } from './gig-job.handler';
import { marketPlaceOrderHandler } from './market-place-order.handler';
import { marketCancelOrderHandler } from './market-cancel-order.handler';
import { marketDayTradeHandler } from './market-day-trade.handler';
import { businessRegisterHandler } from './business-register.handler';
import { businessBuyMachineryHandler } from './business-buy-machinery.handler';
import { businessHireSessionHandler } from './business-hire-session.handler';
import { businessStartProductionHandler } from './business-start-production.handler';

let registered = false;

export function registerAllHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler(eatMealHandler);
  registerHandler(sleepHandler);
  registerHandler(leisureHandler);
  registerHandler(socialCallHandler);
  registerHandler(workShiftHandler);
  registerHandler(gigJobHandler);
  registerHandler(marketPlaceOrderHandler);
  registerHandler(marketCancelOrderHandler);
  registerHandler(marketDayTradeHandler);
  registerHandler(businessRegisterHandler);
  registerHandler(businessBuyMachineryHandler);
  registerHandler(businessHireSessionHandler);
  registerHandler(businessStartProductionHandler);
}
