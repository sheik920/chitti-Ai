import { ArrowLeft, CheckCircle, Zap } from 'lucide-react';

export default function Subscription({ onBack }) {
  const plans = [
    {
      name: 'Weekly',
      price: '₹2,000',
      period: '/week',
      features: ['Basic Agent Access', 'Standard Response Time', '50 Queries/day'],
      recommended: false
    },
    {
      name: 'Monthly',
      price: '₹6,000',
      period: '/month',
      features: ['Advanced Agent Access', 'Fast Response Time', 'Unlimited Queries', 'Priority Support'],
      recommended: true
    },
    {
      name: 'Yearly',
      price: '₹50,000',
      period: '/year',
      features: ['Enterprise Agent Access', 'Ultra-fast Response', 'Unlimited Everything', 'Dedicated 24/7 Support'],
      recommended: false
    }
  ];

  return (
    <div className="subscription-container">
      <div className="subscription-header">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={20} /> Back to Chat
        </button>
        <h2>Upgrade Chitti</h2>
        <p>Unlock the full power of Chitti AI</p>
      </div>

      <div className="plans-grid">
        {plans.map((plan, idx) => (
          <div key={idx} className={`plan-card ${plan.recommended ? 'recommended' : ''}`}>
            {plan.recommended && <div className="recommended-badge"><Zap size={14} /> Most Popular</div>}
            <h3>{plan.name}</h3>
            <div className="plan-price">
              <span className="amount">{plan.price}</span>
              <span className="period">{plan.period}</span>
            </div>
            <ul className="plan-features">
              {plan.features.map((feat, i) => (
                <li key={i}>
                  <CheckCircle size={16} color="#10b981" /> {feat}
                </li>
              ))}
            </ul>
            <button className="subscribe-btn">
              Choose {plan.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
