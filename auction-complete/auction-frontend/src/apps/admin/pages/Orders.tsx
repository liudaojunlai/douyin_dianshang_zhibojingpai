import { useQuery } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import type { Order } from '@/types'

export default function AdminOrders() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders'],
    queryFn: () => orderApi.list({ size: 50 }).then(r => r.data.data),
    refetchInterval: 15000,
  })

  const orders: Order[] = data?.list ?? []
  const total = orders.reduce((s, o) => s + (o.pay_status === 'paid' ? o.final_price : 0), 0)

  return (
    <div style={{ padding: 32, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>成交订单</h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>已收款 ¥{(total / 100).toFixed(2)}</p>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>加载中...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['订单号','商品','成交价','买家','支付状态','成交时间'].map(h => (
                  <th key={h} style={{ padding: '14px 16px', textAlign: 'left',
                    fontSize: 13, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>#{o.id}</td>
                  <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                    {o.auction?.product?.name ?? `竞拍 #${o.auction_id}`}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#ef4444', fontWeight: 700, fontSize: 16 }}>
                    ¥{(o.final_price / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: '14px 16px', color: '#475569', fontSize: 14 }}>
                    {o.winner?.nickname ?? `用户${o.winner_id}`}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                      color: o.pay_status === 'paid' ? '#22c55e' : '#f59e0b',
                      background: o.pay_status === 'paid' ? '#f0fdf4' : '#fef9c3' }}>
                      {o.pay_status === 'paid' ? '已支付' : o.pay_status === 'expired' ? '已过期' : '待支付'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                    {new Date(o.created_at).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!isLoading && orders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>暂无订单</div>
        )}
      </div>
    </div>
  )
}
