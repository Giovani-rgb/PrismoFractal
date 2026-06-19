import { Type } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';

export interface PipelineRouteContract {
  tag: string;
  method: 'POST' | 'GET' | 'PUT';
  handler: (service: any, payload?: any) => any;
  interceptor?: HttpInterceptorFn;
}

export interface RouterStrategy {
  resolvePipeline(tag: string): PipelineRouteContract | undefined;
  getServiceType(): Type<any>;
}
