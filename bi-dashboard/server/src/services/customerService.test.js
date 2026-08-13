/**
 * Unit tests for Customer Service
 *
 * Mocks the database layer to test service logic in isolation,
 * following the same pattern as salesService.test.js.
 */

// Mock better-sqlite3 via the db module
jest.mock('../db', () => {
  const mockPrepare = jest.fn();
  return {
    getDb: jest.fn(() => ({
      prepare: mockPrepare
    })),
    __mockPrepare: mockPrepare
  };
});

const { getInsights } = require('./customerService');

describe('customerService.getInsights', () => {
  let mockPrepare;

  beforeEach(() => {
    mockPrepare = require('../db').__mockPrepare;
    mockPrepare.mockReset();
  });

  describe('repeat rate', () => {
    test('returns 0/0 when no customers exist in range', () => {
      // customerPurchaseFrequency returns empty
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      // topCustomers returns empty
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      // customerRecency returns empty
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.repeatRate).toEqual({ repeat: 0, oneTime: 0 });
    });

    test('correctly identifies repeat vs one-time customers', () => {
      // customerPurchaseFrequency: 3 customers, 2 repeat (count > 1)
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 3, totalSpend: 150, lastPurchaseDate: '2024-01-15' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-06' },
          { customer_id: 'CUST-003', purchaseCount: 2, totalSpend: 100, lastPurchaseDate: '2024-01-20' }
        ]
      });
      // topCustomers
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', totalSpend: 150, purchases: 3 },
          { customer_id: 'CUST-003', totalSpend: 100, purchases: 2 },
          { customer_id: 'CUST-002', totalSpend: 50, purchases: 1 }
        ]
      });
      // customerRecency
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', lastPurchaseDate: '2024-01-15', daysSinceLastPurchase: 16 },
          { customer_id: 'CUST-002', lastPurchaseDate: '2024-01-06', daysSinceLastPurchase: 25 },
          { customer_id: 'CUST-003', lastPurchaseDate: '2024-01-20', daysSinceLastPurchase: 11 }
        ]
      });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      // 2 repeat / 3 total = 67%, 1 one-time / 3 total = 33%
      expect(result.repeatRate.repeat).toBe(67);
      expect(result.repeatRate.oneTime).toBe(33);
    });

    test('returns 100% one-time when all customers have one purchase', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-05' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 30, lastPurchaseDate: '2024-01-06' },
          { customer_id: 'CUST-003', purchaseCount: 1, totalSpend: 20, lastPurchaseDate: '2024-01-07' }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', totalSpend: 50, purchases: 1 },
          { customer_id: 'CUST-002', totalSpend: 30, purchases: 1 },
          { customer_id: 'CUST-003', totalSpend: 20, purchases: 1 }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', lastPurchaseDate: '2024-01-05', daysSinceLastPurchase: 26 },
          { customer_id: 'CUST-002', lastPurchaseDate: '2024-01-06', daysSinceLastPurchase: 25 },
          { customer_id: 'CUST-003', lastPurchaseDate: '2024-01-07', daysSinceLastPurchase: 24 }
        ]
      });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.repeatRate).toEqual({ repeat: 0, oneTime: 100 });
    });

    test('returns whole-number percentages (rounds correctly)', () => {
      // 1 repeat out of 3 = 33.33...%, should round to 33
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 2, totalSpend: 100, lastPurchaseDate: '2024-01-06' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 30, lastPurchaseDate: '2024-01-07' },
          { customer_id: 'CUST-003', purchaseCount: 1, totalSpend: 20, lastPurchaseDate: '2024-01-08' }
        ]
      });
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(Number.isInteger(result.repeatRate.repeat)).toBe(true);
      expect(Number.isInteger(result.repeatRate.oneTime)).toBe(true);
      expect(result.repeatRate.repeat).toBe(33);
      expect(result.repeatRate.oneTime).toBe(67);
    });
  });

  describe('top customers', () => {
    test('returns top customers sorted by spend descending', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-05' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 100, lastPurchaseDate: '2024-01-06' },
          { customer_id: 'CUST-003', purchaseCount: 1, totalSpend: 6, lastPurchaseDate: '2024-01-07' }
        ]
      });
      // topCustomers query returns sorted by spend desc
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-002', totalSpend: 100, purchases: 1 },
          { customer_id: 'CUST-001', totalSpend: 50, purchases: 1 },
          { customer_id: 'CUST-003', totalSpend: 6, purchases: 1 }
        ]
      });
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.topCustomers[0].customerId).toBe('CUST-002');
      expect(result.topCustomers[1].customerId).toBe('CUST-001');
      expect(result.topCustomers[2].customerId).toBe('CUST-003');
    });

    test('returns fewer than 10 if fewer customers exist', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-05' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 30, lastPurchaseDate: '2024-01-06' }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', totalSpend: 50, purchases: 1 },
          { customer_id: 'CUST-002', totalSpend: 30, purchases: 1 }
        ]
      });
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.topCustomers).toHaveLength(2);
    });

    test('includes correct fields: customerId, totalSpend, purchases', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 2, totalSpend: 40, lastPurchaseDate: '2024-01-10' }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', totalSpend: 40, purchases: 2 }
        ]
      });
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.topCustomers[0]).toEqual({
        customerId: 'CUST-001',
        totalSpend: 40,
        purchases: 2
      });
    });
  });

  describe('segments', () => {
    test('classifies active customers (≤30 days from range end)', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-15' }]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', totalSpend: 50, purchases: 1 }]
      });
      // daysSinceLastPurchase = 16 (from Jan 15 to Jan 31) => active
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', lastPurchaseDate: '2024-01-15', daysSinceLastPurchase: 16 }]
      });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.segments.active.count).toBe(1);
      expect(result.segments.active.percentage).toBe(100);
    });

    test('classifies at-risk customers (>60 days from range end)', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-01-15' }]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', totalSpend: 50, purchases: 1 }]
      });
      // daysSinceLastPurchase = 76 (from Jan 15 to Mar 31) => at-risk
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', lastPurchaseDate: '2024-01-15', daysSinceLastPurchase: 76 }]
      });

      const result = getInsights('2024-01-01', '2024-03-31', []);
      expect(result.segments.atRisk.count).toBe(1);
      expect(result.segments.atRisk.percentage).toBe(100);
    });

    test('excludes unclassified customers (between 30 and 60 days)', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-02-01' }]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', totalSpend: 50, purchases: 1 }]
      });
      // daysSinceLastPurchase = 43 => unclassified (not active, not at-risk)
      mockPrepare.mockReturnValueOnce({
        all: () => [{ customer_id: 'CUST-001', lastPurchaseDate: '2024-02-01', daysSinceLastPurchase: 43 }]
      });

      const result = getInsights('2024-01-01', '2024-03-15', []);
      expect(result.segments.active.count).toBe(0);
      expect(result.segments.atRisk.count).toBe(0);
    });

    test('computes correct percentages for mixed segments', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 1, totalSpend: 50, lastPurchaseDate: '2024-03-25' },
          { customer_id: 'CUST-002', purchaseCount: 1, totalSpend: 40, lastPurchaseDate: '2024-03-20' },
          { customer_id: 'CUST-003', purchaseCount: 1, totalSpend: 30, lastPurchaseDate: '2024-01-10' },
          { customer_id: 'CUST-004', purchaseCount: 1, totalSpend: 20, lastPurchaseDate: '2024-02-15' }
        ]
      });
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      // Range end is 2024-03-31
      // CUST-001: 6 days => active, CUST-002: 11 days => active
      // CUST-003: 81 days => at-risk, CUST-004: 45 days => unclassified
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', lastPurchaseDate: '2024-03-25', daysSinceLastPurchase: 6 },
          { customer_id: 'CUST-002', lastPurchaseDate: '2024-03-20', daysSinceLastPurchase: 11 },
          { customer_id: 'CUST-003', lastPurchaseDate: '2024-01-10', daysSinceLastPurchase: 81 },
          { customer_id: 'CUST-004', lastPurchaseDate: '2024-02-15', daysSinceLastPurchase: 45 }
        ]
      });

      const result = getInsights('2024-01-01', '2024-03-31', []);
      // 4 total unique customers
      expect(result.segments.active.count).toBe(2);
      expect(result.segments.active.percentage).toBe(50); // 2/4 * 100
      expect(result.segments.atRisk.count).toBe(1);
      expect(result.segments.atRisk.percentage).toBe(25); // 1/4 * 100
    });

    test('returns zeros when no customers exist', () => {
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      mockPrepare.mockReturnValueOnce({ all: () => [] });
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getInsights('2024-01-01', '2024-01-31', []);
      expect(result.segments).toEqual({
        active: { count: 0, percentage: 0 },
        atRisk: { count: 0, percentage: 0 }
      });
    });
  });

  describe('category filtering', () => {
    test('passes categories to query builder correctly', () => {
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', purchaseCount: 2, totalSpend: 100, lastPurchaseDate: '2024-01-10' }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', totalSpend: 100, purchases: 2 }
        ]
      });
      mockPrepare.mockReturnValueOnce({
        all: () => [
          { customer_id: 'CUST-001', lastPurchaseDate: '2024-01-10', daysSinceLastPurchase: 21 }
        ]
      });

      const result = getInsights('2024-01-01', '2024-01-31', ['Beverages']);
      expect(result.topCustomers).toHaveLength(1);
      expect(result.topCustomers[0].customerId).toBe('CUST-001');
      expect(result.repeatRate.repeat).toBe(100);
    });
  });
});
