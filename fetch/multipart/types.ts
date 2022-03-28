import { ContentTypes, FetchImplementationOpts } from '../types';

export type MultipartRequest = Pick<Request, 'url' | 'method'> & {
  contentType: ContentTypes;
  body?: AnyObj | string;
};

export type MultipartOpts = Omit<
  FetchImplementationOpts,
  'body' | 'contentType'
> & {
  requests: MultipartRequest[];
  boundary?: string;
  parseResponse?: boolean;
};
