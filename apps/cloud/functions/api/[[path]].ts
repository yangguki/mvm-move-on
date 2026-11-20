import { dispatch, normalizeApiPath } from "../../src/router";
import type { CloudEnv } from "../../src/env";

type PagesContext = {
  request: Request;
  env: CloudEnv;
  params: Record<string, string | string[] | undefined>;
};

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const path = normalizeApiPath(context.params.path);
  return dispatch(context.request, context.env, path);
};