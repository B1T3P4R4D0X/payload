import type { PayloadRequest, Where } from 'payload'

import { getTenantFromCookie } from './getTenantFromCookie.js'

type Args = {
  req: PayloadRequest
  tenantFieldName: string
}
export const getTenantListFilter = ({ req, tenantFieldName }: Args): null | Where => {
  const selectedTenant = getTenantFromCookie(req.headers, req.payload.db.defaultIDType)

  return {
    [tenantFieldName]: {
      equals: selectedTenant,
    },
  }
}
