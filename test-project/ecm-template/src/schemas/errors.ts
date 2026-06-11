const errorBody = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const },
    message: { type: 'string' as const }
  }
};

export const commonErrors = {
  400: errorBody,
  401: errorBody,
  403: errorBody,
  404: errorBody,
  409: errorBody,
  500: errorBody
};
