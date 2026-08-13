/**
 * Unit tests for productService.
 * Mocks the database layer to test service logic in isolation.
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

const { getPerformance, getTop, getCategories } = require('./productService');

describe('productService', () => {
  let mockPrepare;

  beforeEach(() => {
    mockPrepare = require('../db').__mockPrepare;
    mockPrepare.mockReset();
  });

  describe('getPerformance', () => {
    it('should compute trend indicators based on revenue change', () => {
      // Current period products
      const currentProducts = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 12000, unitsSold: 200 },
        { product: 'Muffin', category: 'Food', totalRevenue: 5000, unitsSold: 150 },
        { product: 'Juice', category: 'Beverages', totalRevenue: 3000, unitsSold: 80 }
      ];

      // Previous period products (Latte up >5%, Muffin stable, Juice down >5%)
      const prevProducts = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 10000, unitsSold: 180 },
        { product: 'Muffin', category: 'Food', totalRevenue: 4900, unitsSold: 140 },
        { product: 'Juice', category: 'Beverages', totalRevenue: 4000, unitsSold: 100 }
      ];

      // All products in DB (no zero-sale products)
      const allProducts = [
        { product: 'Latte', category: 'Beverages' },
        { product: 'Muffin', category: 'Food' },
        { product: 'Juice', category: 'Beverages' }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })    // current period query
        .mockReturnValueOnce({ all: () => prevProducts })       // previous period query
        .mockReturnValueOnce({ all: () => allProducts });       // all products query

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      // Latte: (12000-10000)/10000*100 = 20% -> "up"
      const latte = result.products.find(p => p.product === 'Latte');
      expect(latte.trend).toBe('up');

      // Muffin: (5000-4900)/4900*100 = ~2% -> "stable"
      const muffin = result.products.find(p => p.product === 'Muffin');
      expect(muffin.trend).toBe('stable');

      // Juice: (3000-4000)/4000*100 = -25% -> "down"
      const juice = result.products.find(p => p.product === 'Juice');
      expect(juice.trend).toBe('down');
    });

    it('should set trend to "stable" when no previous data exists', () => {
      const currentProducts = [
        { product: 'NewProduct', category: 'Food', totalRevenue: 1000, unitsSold: 50 }
      ];
      const prevProducts = []; // No previous data
      const allProducts = [{ product: 'NewProduct', category: 'Food' }];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })
        .mockReturnValueOnce({ all: () => prevProducts })
        .mockReturnValueOnce({ all: () => allProducts });

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      expect(result.products[0].trend).toBe('stable');
    });

    it('should correctly identify slow-moving products', () => {
      // Products: avg units = (200 + 150 + 20) / 3 = ~123.3, threshold = Math.round(123.3 * 0.3) = 37
      const currentProducts = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 12000, unitsSold: 200 },
        { product: 'Muffin', category: 'Food', totalRevenue: 5000, unitsSold: 150 },
        { product: 'Rare Item', category: 'Food', totalRevenue: 500, unitsSold: 20 }
      ];
      const prevProducts = [];
      const allProducts = [
        { product: 'Latte', category: 'Beverages' },
        { product: 'Muffin', category: 'Food' },
        { product: 'Rare Item', category: 'Food' }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })
        .mockReturnValueOnce({ all: () => prevProducts })
        .mockReturnValueOnce({ all: () => allProducts });

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      expect(result.slowMovingThreshold).toBe(37); // Math.round((200+150+20)/3 * 0.3)

      const rareItem = result.products.find(p => p.product === 'Rare Item');
      expect(rareItem.isSlowMoving).toBe(true);
      expect(rareItem.slowMovingThreshold).toBe(37);

      const latte = result.products.find(p => p.product === 'Latte');
      expect(latte.isSlowMoving).toBe(false);
      expect(latte.slowMovingThreshold).toBeNull();
    });

    it('should include products with zero sales in the period', () => {
      const currentProducts = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 5000, unitsSold: 100 }
      ];
      const prevProducts = [];
      // DB has a product not in current results
      const allProducts = [
        { product: 'Latte', category: 'Beverages' },
        { product: 'Discontinued Tea', category: 'Beverages' }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })
        .mockReturnValueOnce({ all: () => prevProducts })
        .mockReturnValueOnce({ all: () => allProducts });

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      const tea = result.products.find(p => p.product === 'Discontinued Tea');
      expect(tea).toBeDefined();
      expect(tea.totalRevenue).toBe(0);
      expect(tea.unitsSold).toBe(0);
      expect(tea.trend).toBe('stable');
    });

    it('should return message when no slow-moving products exist', () => {
      // All products have high units sold — none will be below threshold
      const currentProducts = [
        { product: 'A', category: 'Cat', totalRevenue: 1000, unitsSold: 100 },
        { product: 'B', category: 'Cat', totalRevenue: 1000, unitsSold: 100 }
      ];
      const prevProducts = [];
      const allProducts = [
        { product: 'A', category: 'Cat' },
        { product: 'B', category: 'Cat' }
      ];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })
        .mockReturnValueOnce({ all: () => prevProducts })
        .mockReturnValueOnce({ all: () => allProducts });

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      // Threshold = Math.round(100 * 0.3) = 30, both have 100 units > 30
      expect(result.message).toBe('No slow-moving products identified for the current filters');
    });

    it('should handle previous revenue of 0 as "stable" trend', () => {
      const currentProducts = [
        { product: 'A', category: 'Cat', totalRevenue: 500, unitsSold: 10 }
      ];
      // Previous product had 0 revenue
      const prevProducts = [
        { product: 'A', category: 'Cat', totalRevenue: 0, unitsSold: 0 }
      ];
      const allProducts = [{ product: 'A', category: 'Cat' }];

      mockPrepare
        .mockReturnValueOnce({ all: () => currentProducts })
        .mockReturnValueOnce({ all: () => prevProducts })
        .mockReturnValueOnce({ all: () => allProducts });

      const result = getPerformance('2024-02-01', '2024-02-29', []);

      expect(result.products[0].trend).toBe('stable');
    });
  });

  describe('getTop', () => {
    it('should return top N products by revenue', () => {
      const rows = [
        { product: 'Latte', category: 'Beverages', totalRevenue: 12000, unitsSold: 200 },
        { product: 'Muffin', category: 'Food', totalRevenue: 5000, unitsSold: 150 }
      ];

      mockPrepare.mockReturnValueOnce({ all: () => rows });

      const result = getTop('2024-02-01', '2024-02-29', [], 5);

      expect(result.products).toHaveLength(2);
      expect(result.products[0].product).toBe('Latte');
      expect(result.products[0].totalRevenue).toBe(12000);
    });

    it('should respect the limit parameter', () => {
      const rows = [
        { product: 'A', category: 'Cat', totalRevenue: 1000, unitsSold: 50 }
      ];

      mockPrepare.mockReturnValueOnce({ all: () => rows });

      const result = getTop('2024-02-01', '2024-02-29', [], 1);

      expect(result.products).toHaveLength(1);
    });

    it('should default limit to 5', () => {
      const rows = [];
      mockPrepare.mockReturnValueOnce({ all: () => rows });

      const result = getTop('2024-02-01', '2024-02-29', []);

      expect(result.products).toEqual([]);
    });
  });

  describe('getCategories', () => {
    it('should return category breakdown with percentages', () => {
      const rows = [
        { category: 'Beverages', categoryRevenue: 15000, percentage: 60.0 },
        { category: 'Food', categoryRevenue: 10000, percentage: 40.0 }
      ];

      mockPrepare.mockReturnValueOnce({ all: () => rows });

      const result = getCategories('2024-02-01', '2024-02-29', []);

      expect(result.categories).toHaveLength(2);
      expect(result.categories[0]).toEqual({
        category: 'Beverages',
        revenue: 15000,
        percentage: 60.0
      });
      expect(result.categories[1]).toEqual({
        category: 'Food',
        revenue: 10000,
        percentage: 40.0
      });
    });

    it('should return empty array when no data exists', () => {
      mockPrepare.mockReturnValueOnce({ all: () => [] });

      const result = getCategories('2024-06-01', '2024-06-30', []);

      expect(result.categories).toEqual([]);
    });
  });
});
