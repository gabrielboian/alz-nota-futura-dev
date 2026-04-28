/**
 * Get status background color based on status value for fiscal adjustments
 */
export function getFiscalAdjustmentStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Awaiting statuses - Purple/Violet
    'AWAITING_EMISSION_RETURN': 'bg-[#F5F3FF]',
    'AWAITING_EMISSION_COMPLEMENT': 'bg-[#F5F3FF]',

    // Processing - Blue
    'PROCESSING': 'bg-[#EFF8FF]',

    // Completed - Green
    'COMPLETED': 'bg-[#ECFDF3]',

    // Error - Red
    'ERROR': 'bg-[#FEF3F2]',
  };

  return statusColors[status] || 'bg-gray-100';
}

/**
 * Get status background color for CCT Remittance
 */
export function getCCTRemittanceStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // Awaiting statuses - Purple/Violet
    'AWAITING_EMISSION': 'bg-[#F5F3FF]',
    'AWAITING_FORMATION': 'bg-[#F5F3FF]',

    // Processing - Blue
    'PROCESSING': 'bg-[#EFF8FF]',

    // Completed - Green
    'COMPLETED': 'bg-[#ECFDF3]',

    // Error - Red
    'ERROR': 'bg-[#FEF3F2]',
  };

  return statusColors[status] || 'bg-gray-100';
}