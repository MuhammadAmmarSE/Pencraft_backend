'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import PageHeader from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/lib/api';

const billingApi = {
  getPlans: () => apiClient.get('/billing/plans').then((r) => r.data),
  subscribe: (plan: string) =>
    apiClient.post('/billing/subscribe', { plan }).then((r) => r.data),
  cancel: () => apiClient.delete('/billing/cancel').then((r) => r.data),
};

const PLAN_ORDER = ['free', 'starter', 'growth', 'pro'];

const PLAN_META: Record<string, { color: string; highlight: boolean }> = {
  free:    { color: '#64748B', highlight: false },
  starter: { color: '#0891B2', highlight: false },
  growth:  { color: '#4F46E5', highlight: true  },
  pro:     { color: '#7C3AED', highlight: false },
};

function UpgradePageInner() {
  const { shop, refreshShop } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [subscribingTo, setSubscribingTo] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Handle callback redirect from Shopify billing approval
  useEffect(() => {
    const success = searchParams?.get('success');
    const error = searchParams?.get('error');
    const plan = searchParams?.get('plan');

    if (success === 'true' && plan) {
      toast(`Upgraded to ${plan.charAt(0).toUpperCase() + plan.slice(1)} — welcome!`, 'success');
      refreshShop();
      window.history.replaceState({}, '', '/upgrade');
    }
    if (error) {
      toast(`Billing error: ${decodeURIComponent(error)}`, 'error');
      window.history.replaceState({}, '', '/upgrade');
    }
  }, [searchParams]);

  // Load plans from backend on mount
  useEffect(() => {
    const load = async () => {
      setLoadingPlans(true);
      try {
        const res = await billingApi.getPlans();
        if (res.success) {
          setSubscriptionStatus(res.data.subscriptionStatus);

          const REWRITE_MAP: Record<string, number> = {
            starter: 100,
            growth: 500,
            pro: 99999,
          };

          const allPlans = [
            {
              key: 'free',
              name: 'Free',
              price: 0,
              rewrites: 5,
              features: ['5 rewrites/month', 'Product descriptions', 'SEO title + meta'],
              trialDays: 0,
            },
            ...res.data.availablePlans.map((p: any) => ({
              key: p.planType,
              name: p.name,
              price: p.price,
              rewrites: REWRITE_MAP[p.planType] ?? 100,
              features: p.features,
              trialDays: p.trialDays,
            })),
          ];
          setPlans(allPlans);
        }
      } catch {
        toast('Failed to load plans', 'error');
      } finally {
        setLoadingPlans(false);
      }
    };
    load();
  }, [shop?.plan]);

  const handleSubscribe = async (planKey: string) => {
    if (planKey === 'free') { setShowCancelConfirm(true); return; }
    if (planKey === shop?.plan) return;

    setSubscribingTo(planKey);
    try {
      const res = await billingApi.subscribe(planKey);
      if (res.success && res.data.confirmationUrl) {
        // Redirect merchant to Shopify billing consent page
        window.location.href = res.data.confirmationUrl;
      } else {
        toast('Failed to initiate subscription', 'error');
        setSubscribingTo(null);
      }
    } catch (e: any) {
      toast(e.message || 'Subscription failed', 'error');
      setSubscribingTo(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const res = await billingApi.cancel();
      if (res.success) {
        toast('Subscription cancelled — downgraded to Free', 'info');
        setShowCancelConfirm(false);
        await refreshShop();
        const plansRes = await billingApi.getPlans();
        if (plansRes.success) setSubscriptionStatus(plansRes.data.subscriptionStatus);
      }
    } catch (e: any) {
      toast(e.message || 'Cancellation failed', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const currentPlanKey = shop?.plan ?? 'free';

  return (
    <div className="upgrade-page">
      <PageHeader
        title="Plans & billing"
        subtitle="Upgrade to unlock more rewrites — billed through Shopify, cancel anytime."
      />

      {/* Subscription status banner */}
      {subscriptionStatus && currentPlanKey !== 'free' && (
        <div className={`status-bar status-${subscriptionStatus === 'ACTIVE' ? 'active' : subscriptionStatus === 'FROZEN' ? 'frozen' : 'warning'}`}>
          <div className="status-dot" />
          <span>
            Subscription is <strong>{subscriptionStatus.toLowerCase()}</strong>
            {subscriptionStatus === 'FROZEN' && ' — payment issue. Please update billing in your Shopify admin.'}
          </span>
          {subscriptionStatus === 'ACTIVE' && (
            <button className="btn btn-ghost btn-sm status-cancel-trigger" onClick={() => setShowCancelConfirm(true)}>
              Cancel subscription
            </button>
          )}
        </div>
      )}

      {/* Plans */}
      {loadingPlans ? (
        <div className="plans-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card plan-card">
              <div className="plan-body">
                <div className="skeleton" style={{ width: 70, height: 14, marginBottom: 14 }} />
                <div className="skeleton" style={{ width: 90, height: 36, marginBottom: 10 }} />
                <div className="skeleton" style={{ width: '100%', height: 1, marginBottom: 16 }} />
                {[...Array(5)].map((_, j) => (
                  <div key={j} className="skeleton" style={{ width: '80%', height: 11, marginBottom: 9 }} />
                ))}
                <div className="skeleton" style={{ width: '100%', height: 40, marginTop: 20, borderRadius: 8 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="plans-grid">
          {plans.map((plan) => {
            const isCurrent = currentPlanKey === plan.key;
            const meta = PLAN_META[plan.key] ?? { color: '#64748B', highlight: false };
            const isLoading = subscribingTo === plan.key;
            const rank = PLAN_ORDER.indexOf(plan.key);
            const currentRank = PLAN_ORDER.indexOf(currentPlanKey);
            const isUpgrade = rank > currentRank;

            let ctaLabel = isCurrent ? 'Current plan'
              : plan.key === 'free' ? 'Downgrade to Free'
              : isUpgrade ? `Upgrade to ${plan.name}`
              : `Switch to ${plan.name}`;

            return (
              <div key={plan.key} className={`card plan-card${meta.highlight ? ' plan-highlighted' : ''}${isCurrent ? ' plan-current' : ''}`}>
                {meta.highlight && !isCurrent && <div className="plan-badge plan-badge-popular">Most popular</div>}
                {isCurrent && <div className="plan-badge plan-badge-current">Your plan</div>}

                <div className="plan-body">
                  <div className="plan-name-row">
                    <div className="plan-dot" style={{ background: meta.color }} />
                    <span className="plan-name">{plan.name}</span>
                  </div>

                  <div className="plan-price-row">
                    <span className="plan-price">{plan.price === 0 ? 'Free' : `$${plan.price}`}</span>
                    {plan.price > 0 && <span className="plan-period">/mo</span>}
                  </div>

                  {plan.trialDays > 0 && !isCurrent && (
                    <div className="plan-trial">{plan.trialDays}-day free trial</div>
                  )}

                  <div className="plan-rewrites" style={{ color: meta.color }}>
                    {plan.rewrites === 99999 ? 'Unlimited' : plan.rewrites} rewrites/month
                  </div>

                  <hr className="plan-divider" />

                  <ul className="plan-features">
                    {plan.features.map((f: string) => (
                      <li key={f} className="plan-feature">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                          <path d="M2 6.5l3 3 6-6" stroke="var(--color-success)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    className={`btn btn-md plan-cta${meta.highlight && !isCurrent ? ' btn-primary' : ' btn-secondary'}${isLoading ? ' btn-loading' : ''}`}
                    onClick={() => handleSubscribe(plan.key)}
                    disabled={isCurrent || isLoading}
                  >
                    {isLoading ? '' : ctaLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Billing info */}
      <div className="billing-note card">
        <div className="card-body billing-note-body">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="10" cy="10" r="9" stroke="var(--color-accent)" strokeWidth="1.4"/>
            <path d="M10 9v5M10 7v.5" stroke="var(--color-accent)" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="billing-note-title">Billed through Shopify</div>
            <div className="billing-note-text">
              All charges appear on your Shopify invoice — no separate credit card required.
              Upgrade, downgrade, or cancel at any time from this page. Plan changes take effect immediately.
            </div>
          </div>
        </div>
      </div>

      {/* Cancel confirm modal */}
      {showCancelConfirm && (
        <div className="modal-overlay" onClick={() => !cancelling && setShowCancelConfirm(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="card-header">
              <span style={{ fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Cancel subscription?
              </span>
            </div>
            <div className="card-body" style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.65, marginBottom: 20 }}>
                Your plan will be downgraded to <strong>Free (5 rewrites/month)</strong> immediately.
                You will not be charged again. Remaining rewrites in the current billing period are forfeited.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-md" onClick={() => setShowCancelConfirm(false)} disabled={cancelling}>
                  Keep my plan
                </button>
                <button className={`btn btn-danger btn-md${cancelling ? ' btn-loading' : ''}`} onClick={handleCancel} disabled={cancelling}>
                  {cancelling ? '' : 'Yes, cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .upgrade-page { padding: 32px 36px; max-width: 1020px; }

        .status-bar {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 16px; border-radius: var(--radius-md);
          font-size: var(--text-sm); margin-bottom: 28px; border: 1px solid;
        }
        .status-active  { background: var(--color-success-light); color: var(--color-success); border-color: #A7F3D0; }
        .status-frozen  { background: var(--color-error-light);   color: var(--color-error);   border-color: #FECACA; }
        .status-warning { background: var(--color-warning-light); color: var(--color-warning); border-color: #FDE68A; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; flex-shrink: 0; }
        .status-cancel-trigger { margin-left: auto; color: var(--color-error) !important; }

        .plans-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 16px; margin-bottom: 24px;
        }

        .plan-card { position: relative; transition: transform 0.15s, box-shadow 0.15s; }
        .plan-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .plan-highlighted { border-color: var(--color-accent); box-shadow: 0 0 0 1px var(--color-accent); }
        .plan-current { border-color: var(--color-success); }

        .plan-badge {
          position: absolute; top: -12px; left: 50%; transform: translateX(-50%);
          font-size: 11px; font-weight: 600; padding: 3px 12px;
          border-radius: 20px; white-space: nowrap;
        }
        .plan-badge-popular { background: var(--color-accent); color: white; }
        .plan-badge-current { background: var(--color-success); color: white; }

        .plan-body { padding: 24px 20px; display: flex; flex-direction: column; gap: 0; }
        .plan-name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .plan-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .plan-name { font-size: var(--text-sm); font-weight: 700; color: var(--color-text-primary); }

        .plan-price-row { display: flex; align-items: baseline; gap: 3px; margin-bottom: 4px; }
        .plan-price {
          font-size: 1.85rem; font-weight: 800;
          color: var(--color-text-primary); letter-spacing: -0.03em; line-height: 1;
        }
        .plan-period { font-size: var(--text-xs); color: var(--color-text-muted); }
        .plan-trial { font-size: var(--text-xs); font-weight: 600; color: var(--color-warning); margin-bottom: 4px; }
        .plan-rewrites { font-size: var(--text-xs); font-weight: 600; margin-bottom: 2px; }
        .plan-divider { border: none; height: 1px; background: var(--color-border); margin: 16px 0; }

        .plan-features { list-style: none; display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; flex: 1; }
        .plan-feature {
          display: flex; align-items: flex-start; gap: 7px;
          font-size: 12px; color: var(--color-text-secondary); line-height: 1.4;
        }
        .plan-feature svg { flex-shrink: 0; margin-top: 1px; }
        .plan-cta { width: 100%; }
        .plan-cta:disabled { opacity: 0.55; cursor: not-allowed; }

        .billing-note { border-color: var(--color-accent-border); background: var(--color-accent-light); }
        .billing-note-body { display: flex; align-items: flex-start; gap: 14px; }
        .billing-note-title { font-size: var(--text-sm); font-weight: 600; color: var(--color-text-primary); margin-bottom: 4px; }
        .billing-note-text { font-size: var(--text-sm); color: var(--color-text-secondary); line-height: 1.6; margin: 0; }

        .modal-overlay {
          position: fixed; inset: 0; background: rgba(15,21,35,0.4);
          z-index: 1000; display: flex; align-items: center;
          justify-content: center; backdrop-filter: blur(2px);
        }
        .modal { width: 460px; max-width: 95vw; animation: scaleIn 0.18s ease; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }

        @media (max-width: 900px) { .plans-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px) {
          .plans-grid { grid-template-columns: 1fr; }
          .upgrade-page { padding: 20px; }
        }
      `}</style>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <ToastProvider>
      <AppShell>
        <UpgradePageInner />
      </AppShell>
    </ToastProvider>
  );
}
