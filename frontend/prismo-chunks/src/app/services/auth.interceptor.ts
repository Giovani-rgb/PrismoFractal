import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authReq = req.clone({
    setHeaders: {
      'Authorization': `Bearer ${environment.appSessionSecret}`,
      'X-App-Id': environment.appId,
    },
  });
  return next(authReq);
};
