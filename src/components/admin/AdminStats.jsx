import React from 'react';
import { StatCard } from '../common';
import { gradients } from '../../styles/theme';

/**
 * Admin Stats Cards Component
 * Displays key metrics with beautiful gradient cards
 */
const AdminStats = ({ candidates }) => {
  const total = candidates.length;
  const paid = candidates.filter((c) => c.paid).length;
  const unpaid = total - paid;
  const percentPaid = total > 0 ? Math.round((paid / total) * 100) : 0;
  const manuallyVerified = candidates.filter((c) => c.manuallyVerified).length;

  const totalAmount = candidates.reduce((sum, c) => {
    if (c.paid) {
      const amount = c.paymentDetails?.amount ? Number(c.paymentDetails.amount) : 300;
      return sum + amount;
    }
    return sum;
  }, 0);

  const stats = [
    {
      title: 'Total Candidates',
      value: total,
      subtitle: 'Registered Students',
      icon: '👥',
      gradient: 'primary',
    },
    {
      title: 'Paid',
      value: `${paid} (${percentPaid}%)`,
      subtitle: 'Payment Confirmed',
      icon: '✅',
      gradient: 'success',
      trend: percentPaid > 50 ? { positive: true, value: `${percentPaid}% conversion` } : undefined,
    },
    {
      title: 'Unpaid',
      value: unpaid,
      subtitle: 'Pending Payment',
      icon: '⏳',
      gradient: 'warning',
    },
    {
      title: 'Total Collected',
      value: `₹${totalAmount.toLocaleString()}`,
      subtitle: 'Revenue Generated',
      icon: '💰',
      gradient: 'info',
    },
    {
      title: 'Verified',
      value: `${manuallyVerified} (${paid > 0 ? Math.round((manuallyVerified / paid) * 100) : 0}%)`,
      subtitle: 'Manually Verified',
      icon: '🔒',
      gradient: 'primary',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: theme.spacing.lg,
        marginBottom: theme.spacing.xl,
      }}
    >
      {stats.map((stat, index) => (
        <StatCard
          key={index}
          title={stat.title}
          value={stat.value}
          subtitle={stat.subtitle}
          icon={stat.icon}
          gradient={stat.gradient}
          trend={stat.trend}
        />
      ))}
    </div>
  );
};

export default AdminStats;
