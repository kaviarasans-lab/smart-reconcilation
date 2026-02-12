// Configurable reconciliation matching rules
// Modify these rules without changing business logic code

const reconciliationRules = {
  exactMatch: {
    enabled: true,
    description: 'Transaction ID and Amount must match exactly',
    fields: ['transactionId', 'amount'],
    tolerance: {
      amount: 0, // 0% tolerance for exact match
    },
  },

  partialMatch: {
    enabled: true,
    description: 'Reference Number matches with amount variance within tolerance',
    fields: ['referenceNumber'],
    tolerance: {
      amount: 0.02, // 2% tolerance (±2%)
    },
  },

  duplicate: {
    enabled: true,
    description: 'Same Transaction ID occurs more than once in uploaded data',
    fields: ['transactionId'],
  },
};

module.exports = reconciliationRules;
