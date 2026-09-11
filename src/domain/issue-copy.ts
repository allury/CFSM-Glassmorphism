import type { CfsmRequestIssue } from '@/types/cfsm'

export interface IssueCopy {
  title: string
  body: string
}

/** 详情页与两个图表区共用的请求失败文案。不同错误给出各自的真实原因，从不以模拟数据兜底。 */
export function issueCopy(current: CfsmRequestIssue | null, context: 'detail' | 'history'): IssueCopy {
  if (!current) return { title: '请求失败', body: '无法读取 CFSM 数据。' }
  if (current.kind === 'unauthorized') {
    return {
      title: '需要登录授权',
      body: context === 'history'
        ? '当前时间范围需要有效的 CFSM 登录状态。请登录后重试，现有节点快照不会被替换。'
        : '此节点需要有效的 CFSM 登录状态才能查看。',
    }
  }
  if (current.kind === 'forbidden') {
    return {
      title: '访问被拒绝',
      body: 'CFSM 返回 403。Turnstile 或当前登录权限需要重新验证，现有真实快照会保留。',
    }
  }
  if (current.kind === 'not-found') {
    return { title: '节点不存在', body: '目标数据源未返回这个节点，节点可能已被移除或链接无效。' }
  }
  if (current.kind === 'upgrade-required') {
    return { title: '历史数据库需要升级', body: 'CFSM 返回 databaseUpgradeRequired；升级完成前无法读取这段历史。' }
  }
  if (current.kind === 'unavailable') {
    return { title: '服务暂不可用', body: 'CFSM 返回 503。页面不会使用模拟数据代替真实结果。' }
  }
  if (current.kind === 'server-error') {
    return { title: '服务端请求失败', body: `CFSM 返回 HTTP ${current.status ?? '5xx'}。请稍后重试，页面不会生成替代数据。` }
  }
  if (current.kind === 'network') {
    return { title: '网络请求失败', body: '无法连接所属 CFSM 数据源，请检查网络后重试。' }
  }
  if (current.kind === 'invalid-request') {
    return { title: '请求参数无效', body: 'CFSM 拒绝了当前节点或时间范围参数。' }
  }
  return { title: '读取失败', body: current.message }
}
