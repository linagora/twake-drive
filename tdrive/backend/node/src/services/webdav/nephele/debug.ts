import { ServerResponse, IncomingMessage } from 'http';
import * as Util from 'util';

/** Official "make a pretty string" of this whatever single argument and never throw */
function safeToString(obj) {
  const maxLen = 1000;
  if (!obj)
    return JSON.stringify(obj);
  const className = obj?.__proto__?.constructor?.name;
  if (obj instanceof IncomingMessage)
    return `Request<${JSON.stringify(obj.method)} ${obj.url}>`;
  if (obj instanceof ServerResponse) //obj.setHeader && obj.socket && obj.req)
    return "ServerResponse";
  let description;
  try {
    description = JSON.stringify(obj);
    if (className && className !== "Object" &&
      "undefined number boolean string".split(" ").indexOf(typeof obj) === -1 &&
      !Array.isArray(obj))
      description = `${className}<${description}>`;
  } catch (errorJson) {
    description = Util.inspect(obj);
  }
  if (description.length > maxLen + 3)
    description = description.substr(0, maxLen) + "...";
  if (description === "{}" && className)
    return className;
  return description;
}

/** Official "make this rejection or caught value a pretty string" and never throw */
const errorToLog = (err: any) => err?.message ?? JSON.stringify(err);
// const errorToLog = (err: any) => err;

/** Used by {@see makeCallDebuggingProxy} to log the lifecycle of a single function call */
abstract class CallReporter {
  private static indices: { [kind: string]: { [method: string]: number } } = {};
  private static getCallNum(kind: string, method: string) {
    const kindHash = (this.indices[kind] = this.indices[kind] || {})
    return kindHash[method] = (kindHash[method] ?? -1) + 1;
  }
  protected readonly kind: string;
  protected readonly args: string;
  protected header: string;
  constructor(
    protected readonly obj: object,
    protected readonly method: string,
    kind: KindType,
    args: any[],
    protected readonly returnWrapper?: WrapResult,
  ) {
    this.kind = typeof kind === 'function' ? kind(obj) : kind;
    this.header = `${this.kind}.${method}`;
    this.args = args.map(a => safeToString(a)).join(', ');
    this.callStarted();
  }
  protected reserveCallNumber() {
    const num = CallReporter.getCallNum(this.kind, this.method);
    if (num > 0) this.header += ` #${num}`;
  }
  protected log(verb: string, ...rest: any[]) {
    const verbMaxLength = 10;
    console.error(`${verb.padStart(verbMaxLength)} ${this.header}`, ...rest);
  }
  protected logWithArgs(verb: string, ...rest: any[]) {
    this.log(verb, `(${this.args})`, ...rest);
  }

  protected abstract callStarted()

  public abstract callReturned(result?: any)
  public abstract callFailed(err?: any)

  public callReturnedPromise<T>(promise: Promise<T>): Promise<T> {
    // the reason the promise is tapped here is so the reporter can
    // decide to return before or async from resultp.
    promise.then(
      result => this.callPromiseResolved(result),
      error => this.callPromiseRejected(error)
    );
    return promise;
  }

  protected abstract callPromiseResolved<T>(result: T)
  protected abstract callPromiseRejected<T>(err: T)
}
/**
 * Show calls before they start, results or errors,
 * if promise return then that and the resolution
 */
class CompleteCallReporter extends CallReporter {
  override callStarted() {
    this.reserveCallNumber();
    this.logWithArgs("Start");
  }

  override callReturned(result?: any) {
    this.log("End", "=", safeToString(result));
  }
  override callFailed(err?: any) {
    this.log("Err", "threw", errorToLog(err));
  }

  protected logPromiseStarted() {
    this.log("...", "returned a Promise");
  }
  override callReturnedPromise<T>(promise: Promise<T>): Promise<T> {
    this.logPromiseStarted();
    return super.callReturnedPromise(promise);
  }
  override callPromiseResolved<T>(result: T) {
    this.log("WEnd", "=", safeToString(result));
  }
  override callPromiseRejected(err: any) {
    this.log("WErr", "threw", errorToLog(err));
  }
}

/**
 * Wait for call return or throw before logging,
 * if non promise return, print immediately with
 * arguments, otherwise get a number and show
 * resolution of promise
 */
class FlattenSyncCallReporter extends CompleteCallReporter {
  override callStarted() {}

  override callReturned(result?: any) {
    this.logWithArgs("Call", "=", safeToString(result));
  }
  override callFailed(err?: any) {
    this.logWithArgs("Err", `threw`, errorToLog(err));
  }
  override logPromiseStarted() {
    this.reserveCallNumber();
    this.logWithArgs("Wait");
  }
}
/** Show a single line per call, promise or not, with the result/error */
class ResultsOnlyCallReporter extends FlattenSyncCallReporter {
  override logPromiseStarted() { }
  override callPromiseResolved<T>(result: T) {
    this.logWithArgs("Async", "=", safeToString(result));
  }
  override callPromiseRejected(err: any) {
    this.logWithArgs("Reject", "threw", errorToLog(err));
  }
}

/** Either the name of an expected result type, or a function to make one from it */
type KindType = string | ((obj) => string);
/** A {@see KindType} and optionally an object the keys of which are method names
 * and the values thereof are the {@see WrapResult} to wrap results with before
 * returning
 */
type WrapResultOf<T> = [ kind: T, wrap?: WrapMethods ];
/** When `kind` is a simple value, return values are expected to be direct instances */
export type WrapResultSingle = WrapResultOf<KindType>;
/**
 * When `kind` is an array with a single value, return values are expected to be
 * arrays of direct instances
 */
export type WrapResult = WrapResultOf<KindType | [ KindType ]>;
/**
 * List of methods for that kind that when called, should have the return
 * values also `makeCallDebuggingProxy`'d of
 */
export type WrapMethods = { [method: string]: WrapResult };

function wrapResult(wrapper: WrapResult, result) {
  if (!result || (typeof result != 'object' && typeof result != 'function'))
    return result;
  const [kind, wrapMethods] = wrapper;
  if (Array.isArray(kind))
    if (Array.isArray(result))
      return result.map(item => {
        if (!item || (typeof item != 'object' && typeof item != 'function'))
          return item;
        return makeCallDebuggingProxy(kind[0], item, wrapMethods);
      });
    else
      if (result)
        throw new Error(`Expected array of ${kind[0]} but got ${safeToString(result)}`);
  return makeCallDebuggingProxy(kind as KindType, result, wrapMethods);
}

export function makeCallDebuggingProxy<T extends object>(kind: KindType, obj: T, resultWrappers?: WrapMethods): T {
  return new Proxy(obj, {
    get(target, propKey, receiver) {
      const targetValue = Reflect.get(target, propKey, receiver);
      if (typeof targetValue === 'function') {
        return function (...args) {
          const wrapper = resultWrappers && resultWrappers[String(propKey)];
          const reporter = new ResultsOnlyCallReporter(this, String(propKey), kind, args, wrapper);
          try {
            let result = targetValue.apply(this, args);
            if (result?.then) {
              result = reporter.callReturnedPromise(result);
              if (wrapper)
                return result.then(result => wrapResult(wrapper, result));
            } else
              reporter.callReturned(result);
            if (wrapper)
              return wrapResult(wrapper, result);
            return result;
          } catch (err) {
            reporter.callFailed(err);
            throw err;
          }
        }
      } else {
        return targetValue;
      }
    }
  });
}