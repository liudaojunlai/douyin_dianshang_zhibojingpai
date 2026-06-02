import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auctionApi } from '@/services/api'
import type { Auction } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  pending: '待开始', active: '进行中', sold: '已成交', cancelled: '已取消', draft: '草稿'
}
const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b', active: '#22c55e', sold: '#64748b', cancelled: '#94a3b8', draft: '#cbd5e1'
}

interface FormState {
  name: string; description: string; images: string; imageUrls: string[]
  start_price: string; increment: string; cap_price: string
  duration: string; delay_seconds: string; start_time: string
}

const EMPTY_FORM: FormState = {
  name: '', description: '', images: '[]', imageUrls: [],
  start_price: '10000', increment: '100', cap_price: '0',
  duration: '300', delay_seconds: '10', start_time: '',
}

export default function AdminAuctions() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  const { data } = useQuery({
    queryKey: ['auctions-mine'],
    queryFn: () => auctionApi.listMine().then(r => r.data.data),
    refetchInterval: 10000,
  })

  const createMut = useMutation({
    mutationFn: () => auctionApi.create({
      name: form.name, description: form.description, images: JSON.stringify(form.imageUrls),
      start_price: Math.round(parseFloat(form.start_price) * 100),
      increment:   Math.round(parseFloat(form.increment) * 100),
      cap_price:   Math.round(parseFloat(form.cap_price) * 100),
      duration:    parseInt(form.duration),
      delay_seconds: parseInt(form.delay_seconds),
      start_time: form.start_time ? new Date(form.start_time).toISOString() : undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['auctions-mine'] })
      setShowForm(false)
      setForm(EMPTY_FORM)
    },
  })

  const cancelMut = useMutation({
    mutationFn: (id: number) => auctionApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auctions-mine'] }),
  })

  const auctions: Auction[] = data?.list ?? []

  const inp = (label: string, key: keyof FormState, type = 'text', hint = '') => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
        color: '#374151', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
          borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
      />
      {hint && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{hint}</div>}
    </div>
  )

  return (
    <div style={{ padding: 32, background: '#f8fafc', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a' }}>竞拍管理</h1>
        <button onClick={() => setShowForm(true)} style={{
          padding: '10px 24px', borderRadius: 10, border: 'none',
          background: 'linear-gradient(135deg,#ef4444,#dc2626)',
          color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + 发布竞拍
        </button>
      </div>

      {/* 发布表单 */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 32, width: 560,
            maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.2)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 24 }}>发布新竞拍</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
              <div style={{ gridColumn: '1/-1' }}>{inp('商品名称 *', 'name')}</div>
              <div style={{ gridColumn: '1/-1' }}>{inp('商品描述', 'description')}</div>
              
              {/* 图片上传区域 */}
              <div style={{ gridColumn: '1/-1', marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
                  color: '#374151', marginBottom: 6 }}>商品图片</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {form.imageUrls.map((url, idx) => (
                    <div key={idx} style={{ position: 'relative', width: 80, height: 80 }}>
                      <img src={url} alt={`商品图片${idx+1}`} style={{
                        width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8, border: '1px solid #e2e8f0'
                      }} />
                      <button onClick={() => setForm(f => ({ ...f, imageUrls: f.imageUrls.filter((_, i) => i !== idx) }))}
                        style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                          borderRadius: '50%', background: '#ef4444', color: '#fff', border: 'none',
                          cursor: 'pointer', fontSize: 12, fontWeight: 'bold', display: 'flex',
                          alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  ))}
                  <label style={{ width: 80, height: 80, border: '2px dashed #cbd5e1',
                    borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#94a3b8', fontSize: 24 }}>
                    +
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(file => {
                            const reader = new FileReader()
                            reader.onload = (ev) => {
                              setForm(f => ({ ...f, imageUrls: [...f.imageUrls, ev.target?.result as string] }))
                            }
                            reader.readAsDataURL(file)
                          })
                        }
                      }} />
                  </label>
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>
                  提示：点击 + 号可以添加本地图片，也可以直接输入图片URL（下方输入框）
                </div>
              </div>

              {/* 图片URL输入 */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600,
                  color: '#374151', marginBottom: 6 }}>图片URL（可选，多个用英文逗号分隔）</label>
                <input type="text" placeholder="例如：https://example.com/img1.jpg, https://example.com/img2.jpg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const urls = e.currentTarget.value.split(',').map(u => u.trim()).filter(u => u)
                      setForm(f => ({ ...f, imageUrls: [...f.imageUrls, ...urls] }))
                      e.currentTarget.value = ''
                    }
                  }}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0',
                    borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>

              {inp('起拍价（元）*', 'start_price', 'number')}
              {inp('加价幅度（元）*', 'increment', 'number')}
              {inp('封顶价（元，0=不设）', 'cap_price', 'number')}
              {inp('竞拍时长（秒）*', 'duration', 'number', '建议 300（5分钟）')}
              {inp('延时秒数（10-30）', 'delay_seconds', 'number')}
              {inp('开始时间', 'start_time', 'datetime-local', '留空=立即开始')}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={() => setShowForm(false)} style={{
                flex: 1, padding: '12px 0', borderRadius: 10, border: '1px solid #e2e8f0',
                background: '#f8fafc', color: '#64748b', fontWeight: 600, cursor: 'pointer' }}>
                取消
              </button>
              <button onClick={() => createMut.mutate()} disabled={createMut.isPending || !form.name}
                style={{ flex: 2, padding: '12px 0', borderRadius: 10, border: 'none',
                  background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff',
                  fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: !form.name ? .5 : 1 }}>
                {createMut.isPending ? '发布中...' : '确认发布'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 列表 */}
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['商品名称','当前价','状态','延时次数','结束时间','操作'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left',
                  fontSize: 13, fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auctions.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '14px 16px', fontWeight: 600, color: '#0f172a', fontSize: 14 }}>
                  {a.product?.name}
                </td>
                <td style={{ padding: '14px 16px', color: '#ef4444', fontWeight: 700 }}>
                  ¥{(a.current_price / 100).toFixed(2)}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                    color: STATUS_COLOR[a.status], background: STATUS_COLOR[a.status] + '20' }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                </td>
                <td style={{ padding: '14px 16px', color: '#64748b', fontSize: 14 }}>
                  {a.extend_count} 次
                </td>
                <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>
                  {a.end_time ? new Date(a.end_time).toLocaleString('zh-CN') : '-'}
                </td>
                <td style={{ padding: '14px 16px' }}>
                  {(a.status === 'pending' || a.status === 'active') && (
                    <button
                      onClick={() => { if (confirm('确认取消此竞拍？')) cancelMut.mutate(a.id) }}
                      style={{ padding: '6px 14px', border: '1px solid #fca5a5', borderRadius: 6,
                        background: '#fff5f5', color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      取消
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {auctions.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            暂无竞拍记录
          </div>
        )}
      </div>
    </div>
  )
}
