import type { CfsmRequestIssue, CfsmRequestIssueKind } from '@/types/cfsm'
import { CfsmRequestError } from './http'

function issueKind(status: number | null, code: string | null): CfsmRequestIssueKind {
  if (status === 400) return 'invalid-request'
  if (status === 401) return 'unauthorized'
  if (status === 404) return 'not-found'
  if (status === 409 || code === 'databaseUpgradeRequired') return 'upgrade-required'
  if (status === 503) return 'unavailable'
  if (status === null && (code === 'networkError' || code === 'timeout')) return 'network'
  return 'unknown'
}

export function classifyCfsmRequestError(error: unknown): CfsmRequestIssue {
  if (error instanceof CfsmRequestError) {
    return {
      kind: issueKind(error.status, error.code),
      status: error.status,
      code: error.code,
      message: error.message,
    }
  }

  return {
    kind: 'unknown',
    status: null,
    code: null,
    message: error instanceof Error ? error.message : 'Unknown CFSM request error',
  }
}
