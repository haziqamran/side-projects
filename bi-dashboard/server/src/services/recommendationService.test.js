/**
 * Unit tests for recommendationService.
 * Mocks the database layer to test recommendation logic in isolation.
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

const { getRecommendations } = require('./recommendationService');

describe('recommendationService', () => {
  let mockPrepare;

  beforeEach(() => {
    mockPrepare = require('../db').__mockPrepare;
    mockPrepare.mockReset();
  });

  describe('getRecommendations', () => {
    it('should generate all three types of recommendations when data permits', () => {
      // Current period: category revenue
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 800, percentage: 40 },
        { category: 'Food', categoryRevenue: 1200, percentage: 60 }
      ];
      // Previous period: category revenue (Beverages declined, Food grew)
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 50 },
        { category: 'Food', categoryRevenue: 1000, percentage: 50 }
      ];
      // Products: include a zero-sale product
      const products = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 800, unitsSold: 100 },
        { product: 'Garlic Bread', category: 'Food', totalRevenue: 0, unitsSold: 0 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      expect(result.recommendations.length).toBeGreaterThanOrEqual(3);
      expect(result.insufficientData).toBe(false);

      // Check declining category recommendation
      expect(result.recommendations[0]).toContain('Beverages');
      expect(result.recommendations[0]).toContain('declined');
      expect(result.recommendations[0]).toContain('20%');

      // Check zero-sale product recommendation
      expect(result.recommendations[1]).toContain('Garlic Bread');
      expect(result.recommendations[1]).toContain('zero sales');

      // Check highest-growth category recommendation
      expect(result.recommendations[2]).toContain('Food');
      expect(result.recommendations[2]).toContain('fastest-growing');
      expect(result.recommendations[2]).toContain('20%');
    });

    it('should set insufficientData to true when fewer than 3 insights generated', () => {
      // No decline, no zero-sales, no growth → no recommendations
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 100 }
      ];
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 100 }
      ];
      const products = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 1000, unitsSold: 50 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      expect(result.insufficientData).toBe(true);
      expect(result.recommendations.length).toBeLessThan(3);
    });

    it('should list up to 3 zero-sale product names in one recommendation', () => {
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 100 }
      ];
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 100 }
      ];
      const products = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 1000, unitsSold: 50 },
        { product: 'Matcha', category: 'Beverages', totalRevenue: 0, unitsSold: 0 },
        { product: 'Espresso', category: 'Beverages', totalRevenue: 0, unitsSold: 0 },
        { product: 'Mocha', category: 'Beverages', totalRevenue: 0, unitsSold: 0 },
        { product: 'Tea', category: 'Beverages', totalRevenue: 0, unitsSold: 0 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      // Should list only up to 3 products
      const zeroSaleRec = result.recommendations.find(r => r.includes('zero sales'));
      expect(zeroSaleRec).toBeDefined();
      expect(zeroSaleRec).toContain('Matcha');
      expect(zeroSaleRec).toContain('Espresso');
      expect(zeroSaleRec).toContain('Mocha');
      expect(zeroSaleRec).not.toContain('Tea');
    });

    it('should not generate a decline recommendation if decline is less than 10%', () => {
      // 5% decline — not enough to trigger
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 950, percentage: 100 }
      ];
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 100 }
      ];
      const products = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 950, unitsSold: 50 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      const declineRecs = result.recommendations.filter(r => r.includes('declined'));
      expect(declineRecs.length).toBe(0);
    });

    it('should handle categories with no previous period data', () => {
      // New category that didn't exist in previous period
      const currentCategories = [
        { category: 'NewCategory', categoryRevenue: 500, percentage: 100 }
      ];
      const previousCategories = [];
      const products = [
        { product: 'New Item', category: 'NewCategory', totalRevenue: 500, unitsSold: 10 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      // Previous revenue is 0, so computePercentageChange returns null
      // No decline and no growth recommendation (null change is skipped)
      const declineRecs = result.recommendations.filter(r => r.includes('declined'));
      expect(declineRecs.length).toBe(0);
    });

    it('should ensure each recommendation is at most 2 sentences', () => {
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 500, percentage: 40 },
        { category: 'Food', categoryRevenue: 1500, percentage: 60 }
      ];
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 50 },
        { category: 'Food', categoryRevenue: 1000, percentage: 50 }
      ];
      const products = [
        { product: 'Garlic Bread', category: 'Food', totalRevenue: 0, unitsSold: 0 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      for (const rec of result.recommendations) {
        // Count sentences (splitting by '. ' and final period)
        const sentences = rec.split(/\.\s/).filter(s => s.length > 0);
        expect(sentences.length).toBeLessThanOrEqual(2);
      }
    });

    it('should identify the correct highest-growth category among multiple', () => {
      const currentCategories = [
        { category: 'Beverages', categoryRevenue: 1100, percentage: 30 },
        { category: 'Food', categoryRevenue: 1500, percentage: 40 },
        { category: 'Merchandise', categoryRevenue: 1200, percentage: 30 }
      ];
      const previousCategories = [
        { category: 'Beverages', categoryRevenue: 1000, percentage: 33 },
        { category: 'Food', categoryRevenue: 1000, percentage: 33 },
        { category: 'Merchandise', categoryRevenue: 1000, percentage: 34 }
      ];
      const products = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 1100, unitsSold: 50 },
        { product: 'Sandwich', category: 'Food', totalRevenue: 1500, unitsSold: 80 },
        { product: 'T-Shirt', category: 'Merchandise', totalRevenue: 1200, unitsSold: 30 }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: (...params) => currentCategories })
        .mockReturnValueOnce({ all: (...params) => previousCategories })
        .mockReturnValueOnce({ all: (...params) => products });

      const result = getRecommendations('2024-02-01', '2024-02-29', []);

      // Food has the highest growth: (1500-1000)/1000 * 100 = 50%
      const growthRec = result.recommendations.find(r => r.includes('fastest-growing'));
      expect(growthRec).toContain('Food');
      expect(growthRec).toContain('50%');
    });
  });
});
