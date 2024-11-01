export type {
  Adapter as INepheleAdapter,
  Authenticator as INepheleAuthenticator,
  AuthResponse as INepheleAuthResponse,
  Lock as INepheleLock,
  Method,
  Properties as INepheleProperties,
  Resource as INepheleResource,
  User as INepheleUser,
} from "nephele";

import type * as Nephele from "nephele";

export type NepheleModule = Awaited<typeof NephelePromise>;

let loadedModule: NepheleModule = undefined;

/**
 * Because of TS transpiling require calls and nephele being incompatible with twake drive's compilation,
 * this horrible eval hack is required. This file largely exists to only do this in one place.
 */
export const NephelePromise = (eval("import('nephele')") as Promise<any>).then(nepheleModule => ({
  createServer: nepheleModule.createServer as typeof Nephele.createServer,
  BadGatewayError: nepheleModule.BadGatewayError as typeof Nephele.BadGatewayError,
  BadRequestError: nepheleModule.BadRequestError as typeof Nephele.BadRequestError,
  EncodingNotSupportedError:
    nepheleModule.EncodingNotSupportedError as typeof Nephele.EncodingNotSupportedError,
  ForbiddenError: nepheleModule.ForbiddenError as typeof Nephele.ForbiddenError,
  InsufficientStorageError:
    nepheleModule.InsufficientStorageError as typeof Nephele.InsufficientStorageError,
  InternalServerError: nepheleModule.InternalServerError as typeof Nephele.InternalServerError,
  LockedError: nepheleModule.LockedError as typeof Nephele.LockedError,
  MediaTypeNotSupportedError:
    nepheleModule.MediaTypeNotSupportedError as typeof Nephele.MediaTypeNotSupportedError,
  MethodNotImplementedError:
    nepheleModule.MethodNotImplementedError as typeof Nephele.MethodNotImplementedError,
  MethodNotSupportedError:
    nepheleModule.MethodNotSupportedError as typeof Nephele.MethodNotSupportedError,
  NotAcceptableError: nepheleModule.NotAcceptableError as typeof Nephele.NotAcceptableError,
  PreconditionFailedError:
    nepheleModule.PreconditionFailedError as typeof Nephele.PreconditionFailedError,
  PropertyIsProtectedError:
    nepheleModule.PropertyIsProtectedError as typeof Nephele.PropertyIsProtectedError,
  PropertyNotFoundError:
    nepheleModule.PropertyNotFoundError as typeof Nephele.PropertyNotFoundError,
  RangeNotSatisfiableError:
    nepheleModule.RangeNotSatisfiableError as typeof Nephele.RangeNotSatisfiableError,
  RequestTimeoutError: nepheleModule.RequestTimeoutError as typeof Nephele.RequestTimeoutError,
  RequestURITooLongError:
    nepheleModule.RequestURITooLongError as typeof Nephele.RequestURITooLongError,
  ResourceExistsError: nepheleModule.ResourceExistsError as typeof Nephele.ResourceExistsError,
  ResourceNotFoundError:
    nepheleModule.ResourceNotFoundError as typeof Nephele.ResourceNotFoundError,
  ResourceNotModifiedError:
    nepheleModule.ResourceNotModifiedError as typeof Nephele.ResourceNotModifiedError,
  ResourceTreeNotCompleteError:
    nepheleModule.ResourceTreeNotCompleteError as typeof Nephele.ResourceTreeNotCompleteError,
  ServiceUnavailableError:
    nepheleModule.ServiceUnavailableError as typeof Nephele.ServiceUnavailableError,
  UnauthorizedError: nepheleModule.UnauthorizedError as typeof Nephele.UnauthorizedError,
  UnprocessableEntityError:
    nepheleModule.UnprocessableEntityError as typeof Nephele.UnprocessableEntityError,
}));

NephelePromise.then(nepheleModule => (loadedModule = nepheleModule));

/**
 * The only difference with using {@see NephelePromise}'s `then` is that if its
 * alredy loaded, the `callback` is synchroneously called.
 */
export async function withNephele<T>(
  callback: (nephele: NepheleModule) => Promise<T> | T,
): Promise<T> {
  if (loadedModule) return callback(loadedModule);
  return NephelePromise.then(callback);
}
