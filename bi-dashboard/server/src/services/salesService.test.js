/**
 * Unit tests for salesService.
 * Mocks the database layer to test service logic in isolation.
 */
const { getDb } = require('../db');
const { computePercentageChange } = require('../models/queries');

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

const { getOverview, getTrend } = require('./salesService');

describe('salesService', () => {
  let mockPrepare;

  beforeEach(() => {
    mockPrepare = require('../db').__mockPrepare;
    mockPrepare.mockReset();
  });

  describe('getOverview', () => {
    it('should return current and previous metrics with percentage changes', () => {
      // Mock current period result
      const currentResult = { totalRevenue: 10000, totalOrders: 100 };
      // Mock previous period result
      const previousResult = { totalRevenue: 8000, totalOrders: 80 };

      mockPrepare
        .mockReturnValueOnce({ get: (...params) => currentResult })
        .mockReturnValueOnce({ get: (...params) => previousResult });

      const result = getOverview('2024-02-01', '2024-02-29', []);

      expect(result.current).toEqual({
        totalRevenue: 10000,
        totalOrders: 100,
        avgOrderValue: 100.00
      });
      expect(result.previous).toEqual({
        totalRevenue: 8000,
        totalOrders: 80,
        avgOrderValue: 100.00
      });
      // Both periods have same AOV=100, so AOV change = 0
      expect(result.change.totalRevenue).toBe(25.0); // (10000-8000)/8000 * 100
      expect(result.change.totalOrders).toBe(25.0);  // (100-80)/80 * 100
      expect(result.change.avgOrderValue).toBe(0);
    });

    it('should return null changes when previous period has no data', () => {
      const currentResult = { totalRevenue: 5000, totalOrders: 50 };
      const previousResult = { totalRevenue: 0, totalOrders: 0 };

      mockPrepare
        .mockReturnValueOnce({ get: (...params) => currentResult })
        .mockReturnValueOnce({ get: (...params) => previousResult });

      const result = getOverview('2024-01-01', '2024-01-31', []);

      expect(result.current.totalRevenue).toBe(5000);
      expect(result.current.totalOrders).toBe(50);
      expect(result.current.avgOrderValue).toBe(100.00);

      expect(result.previous.totalRevenue).toBe(0);
      expect(result.previous.totalOrders).toBe(0);
      expect(result.previous.avgOrderValue).toBe(0);

      // All changes should be null since previous has no orders
      expect(result.change.totalRevenue).toBeNull();
      expect(result.change.totalOrders).toBeNull();
      expect(result.change.avgOrderValue).toBeNull();
    });

    it('should handle division by zero for average order value', () => {
      // Current period has no orders either
      const currentResult = { totalRevenue: 0, totalOrders: 0 };
      const previousResult = { totalRevenue: 0, totalOrders: 0 };

      mockPrepare
        .mockReturnValueOnce({ get: (...params) => currentResult })
        .mockReturnValueOnce({ get: (...params) => previousResult });

      const result = getOverview('2024-03-01', '2024-03-31', []);

      expect(result.current.avgOrderValue).toBe(0);
      expect(result.previous.avgOrderValue).toBe(0);
      expect(result.change.totalRevenue).toBeNull();
      expect(result.change.totalOrders).toBeNull();
      expect(result.change.avgOrderValue).toBeNull();
    });

    it('should pass categories filter correctly', () => {
      const currentResult = { totalRevenue: 3000, totalOrders: 30 };
      const previousResult = { totalRevenue: 2500, totalOrders: 25 };

      mockPrepare
        .mockReturnValueOnce({ get: (...params) => currentResult })
        .mockReturnValueOnce({ get: (...params) => previousResult });

      const result = getOverview('2024-01-01', '2024-01-31', ['Electronics', 'Beverages']);

      // Verify it returned the expected structure
      expect(result.current.totalRevenue).toBe(3000);
      expect(result.previous.totalRevenue).toBe(2500);
      expect(result.change.totalRevenue).toBe(20.0); // (3000-2500)/2500 * 100
    });
  });

  describe('getTrend', () => {
    it('should return trend data with daily granularity', () => {
      const rows = [
        { period: '2024-01-01', revenue: 500 },
        { period: '2024-01-02', revenue: 750 },
        { period: '2024-01-03', revenue: 600 }
      ];

      mockPrepare.mockReturnValueOnce({ all: (...params) => rows });

      const result = getTrend('2024-01-01', '2024-01-03', [], 'daily');

      expect(result.data).toEqual([
        { period: '2024-01-01', revenue: 500 },
        { period: '2024-01-02', revenue: 750 },
        { period: '2024-01-03', revenue: 600 }
      ]);
    });

    it('should return trend data with weekly granularity', () => {
      const rows = [
        { period: '2024-W01', revenue: 3500 },
        { period: '2024-W02', revenue: 4200 }
      ];

      mockPrepare.mockReturnValueOnce({ all: (...params) => rows });

      const result = getTrend('2024-01-01', '2024-01-14', [], 'weekly');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].period).toBe('2024-W01');
      expect(result.data[0].revenue).toBe(3500);
    });

    it('should return trend data with monthly granularity', () => {
      const rows = [
        { period: '2024-01', revenue: 15000 },
        { period: '2024-02', revenue: 18000 }
      ];

      mockPrepare.mockReturnValueOnce({ all: (...params) => rows });

      const result = getTrend('2024-01-01', '2024-02-29', [], 'monthly');

      expect(result.data).toHaveLength(2);
      expect(result.data[0].period).toBe('2024-01');
    });

    it('should return empty data array when no transactions exist', () => {
      mockPrepare.mockReturnValueOnce({ all: (...params) => [] });

      const result = getTrend('2024-06-01', '2024-06-30', [], 'daily');

      expect(result.data).toEqual([]);
    });

    it('should default to daily granularity when not specified', () => {
      const rows = [{ period: '2024-01-01', revenue: 100 }];
      mockPrepare.mockReturnValueOnce({ all: (...params) => rows });

      const result = getTrend('2024-01-01', '2024-01-01', []);

      expect(result.data).toEqual([{ period: '2024-01-01', revenue: 100 }]);
    });
  });
});
