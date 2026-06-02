import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { orderApi } from '@/services/api'
import type { Order } from '@/types'

export default function OrdersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => orderApi.list().then(r => r.data.data),
  })
  const payMut = useMutation({
    mutationFn: (id: number) => orderApi.pay(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }),
  })

  const orders: Order[] = data?.list ?? []

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>我的订单</h1>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>加载中...</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>暂无订单</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {orders.map(o => (
            <div key={o.id} style={{ background: '#fff', borderRadius: 16, padding: 16,
              boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>
                  {o.auction?.product?.name ?? `竞拍 #${o.auction_id}`}
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  color: o.pay_status === 'paid' ? '#22c55e' : '#f59e0b',
                  background: o.pay_status === 'paid' ? '#f0fdf4' : '#fef9c3',
                }}>
                  {o.pay_status === 'paid' ? '已支付' : o.pay_status === 'expired' ? '已过期' : '待支付'}
                </span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', marginBottom: 12 }}>
                ¥{(o.final_price / 100).toFixed(2)}
              </div>
              {o.pay_status === 'pending' && (
                <button
                  onClick={() => payMut.mutate(o.id)}
                  disabled={payMut.isPending}
                  style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 10,
                    background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#fff',
                    fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                  {payMut.isPending ? '支付中...' : '立即支付'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
