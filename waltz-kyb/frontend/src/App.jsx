import { useEffect, useState } from 'react'
import { api } from './api'
import Sidebar from './components/Sidebar'
import DealHeader from './components/DealHeader'
import NewDealModal from './components/NewDealModal'
import DocumentsTab from './components/tabs/DocumentsTab'
import ValidationTab from './components/tabs/ValidationTab'
import FactsTab from './components/tabs/FactsTab'
import MembersTab from './components/tabs/MembersTab'
import AuditTab from './components/tabs/AuditTab'

const TABS = [
  { id: 'documents',   label: 'Documents' },
  { id: 'validation',  label: 'Validation' },
  { id: 'facts',       label: 'Entity Facts' },
  { id: 'members',     label: 'Members' },
  { id: 'audit',       label: 'Audit Log' },
]

export default function App() {
  const [deals, setDeals]           = useState([])
  const [selectedDeal, setSelectedDeal] = useState(null)
  const [activeTab, setActiveTab]   = useState('documents')
  const [showModal, setShowModal]   = useState(false)
  const [navTab, setNavTab]         = useState('deals')

  useEffect(() => {
    api.listDeals().then(setDeals).catch(console.error)
  }, [])

  const selectDeal = async (id) => {
    try {
      const deal = await api.getDeal(id)
      setSelectedDeal(deal)
      setActiveTab('documents')
      setNavTab('deals')
    } catch (e) {
      console.error(e)
    }
  }

  const refreshDeal = async () => {
    if (!selectedDeal) return
    try {
      const deal = await api.getDeal(selectedDeal.id)
      setSelectedDeal(deal)
      const updated = await api.listDeals()
      setDeals(updated)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDealCreated = async (deal) => {
    setShowModal(false)
    const updated = await api.listDeals()
    setDeals(updated)
    selectDeal(deal.id)
  }

  const ruleStats = selectedDeal ? (() => {
    const rules = selectedDeal.rule_results || []
    return {
      pass:    rules.filter(r => r.status === 'pass').length,
      flag:    rules.filter(r => r.status === 'flag' && !r.resolved).length,
      fail:    rules.filter(r => r.status === 'fail' && !r.resolved).length,
      manual:  rules.filter(r => r.status === 'manual' && !r.resolved).length,
      pending: rules.filter(r => r.status === 'pending').length,
      total:   rules.length,
    }
  })() : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Nav */}
      <nav style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: '0 20px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8 }}>
          <div style={{
            width: 28, height: 28, background: 'var(--accent)',
            borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>W</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Waltz KYB</span>
        </div>

        {['deals', 'audit'].map(tab => (
          <button key={tab} onClick={() => setNavTab(tab)} style={{
            background: 'none', border: 'none', padding: '4px 0',
            color: navTab === tab ? 'var(--accent)' : 'var(--text2)',
            fontWeight: navTab === tab ? 600 : 400,
            fontSize: 13,
            borderBottom: navTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            textTransform: 'capitalize',
          }}>
            {tab === 'audit' ? 'Audit Log' : 'Deals'}
          </button>
        ))}

        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => setShowModal(true)} style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
          }}>
            + New Deal
          </button>
        </div>
      </nav>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <Sidebar deals={deals} selectedId={selectedDeal?.id} onSelect={selectDeal} />

        {/* Main Content */}
        <main style={{ flex: 1, overflow: 'auto', padding: 24, background: 'var(--bg)' }}>
          {!selectedDeal ? (
            <div style={{
              height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text3)',
            }}>
              <div style={{ fontSize: 40 }}>📋</div>
              <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--text2)' }}>
                Select a deal or create a new one
              </div>
              <button onClick={() => setShowModal(true)} style={{
                background: 'var(--accent)', color: '#fff', border: 'none',
                borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, marginTop: 4,
              }}>
                + New Deal
              </button>
            </div>
          ) : (
            <div style={{ maxWidth: 1100, margin: '0 auto' }}>
              <DealHeader deal={selectedDeal} onRefresh={refreshDeal} ruleStats={ruleStats} />

              {/* Tab Bar */}
              <div style={{
                display: 'flex', gap: 2, marginBottom: 20,
                borderBottom: '1px solid var(--border)',
              }}>
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                    background: 'none', border: 'none',
                    padding: '8px 16px', fontSize: 13,
                    color: activeTab === tab.id ? 'var(--accent)' : 'var(--text2)',
                    fontWeight: activeTab === tab.id ? 600 : 400,
                    borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                    {tab.label}
                    {tab.id === 'validation' && ruleStats && (ruleStats.fail + ruleStats.flag) > 0 && (
                      <span style={{
                        marginLeft: 6,
                        background: ruleStats.fail > 0 ? 'var(--red)' : 'var(--amber)',
                        color: '#fff', borderRadius: 9, padding: '1px 6px', fontSize: 10, fontWeight: 700,
                      }}>
                        {ruleStats.fail + ruleStats.flag}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'documents'  && <DocumentsTab  deal={selectedDeal} onRefresh={refreshDeal} />}
              {activeTab === 'validation' && <ValidationTab deal={selectedDeal} onRefresh={refreshDeal} />}
              {activeTab === 'facts'      && <FactsTab      deal={selectedDeal} onRefresh={refreshDeal} />}
              {activeTab === 'members'    && <MembersTab    deal={selectedDeal} onRefresh={refreshDeal} />}
              {activeTab === 'audit'      && <AuditTab      deal={selectedDeal} />}
            </div>
          )}
        </main>
      </div>

      {showModal && (
        <NewDealModal onClose={() => setShowModal(false)} onCreated={handleDealCreated} />
      )}
    </div>
  )
}
