import { registerHandler } from './registry';
import { eatMealHandler } from './eat-meal.handler';
import { sleepHandler } from './sleep.handler';
import { leisureHandler } from './leisure.handler';
import { socialCallHandler } from './social-call.handler';
import { workShiftHandler } from './work-shift.handler';
import { marketPlaceOrderHandler } from './market-place-order.handler';
import { marketCancelOrderHandler } from './market-cancel-order.handler';
import { marketDayTradeHandler } from './market-day-trade.handler';

let registered = false;

export function registerAllHandlers(): void {
  if (registered) return;
  registered = true;

  registerHandler(eatMealHandler);
  registerHandler(sleepHandler);
  registerHandler(leisureHandler);
  registerHandler(socialCallHandler);
  registerHandler(workShiftHandler);
  registerHandler(marketPlaceOrderHandler);
  registerHandler(marketCancelOrderHandler);
  registerHandler(marketDayTradeHandler);
}
