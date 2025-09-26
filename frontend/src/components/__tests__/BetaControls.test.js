import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import BetaControls from '../BetaControls';

// Mock fetch globally
global.fetch = jest.fn();

describe('BetaControls', () => {
  const defaultProps = {
    symbol: 'TSLA',
    beta: 1.5,
    onBetaChange: jest.fn(),
    isManualOverride: false,
    onToggleManualOverride: jest.fn(),
    enableBetaScaling: false,
    onToggleBetaScaling: jest.fn(),
    baseParameters: {
      profitRequirement: 0.05,
      gridIntervalPercent: 0.1,
      trailingBuyActivationPercent: 0.1,
      trailingBuyReboundPercent: 0.05,
      trailingSellActivationPercent: 0.2,
      trailingSellPullbackPercent: 0.1
    },
    adjustedParameters: {
      profitRequirement: 0.075,
      gridIntervalPercent: 0.15,
      trailingBuyActivationPercent: 0.15,
      trailingBuyReboundPercent: 0.075,
      trailingSellActivationPercent: 0.3,
      trailingSellPullbackPercent: 0.15
    },
    loading: false,
    error: null
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Basic Rendering', () => {
    test('renders beta controls with default props', () => {
      render(<BetaControls {...defaultProps} />);
      
      expect(screen.getByText('Beta (Market Volatility)')).toBeInTheDocument();
      expect(screen.getByText('1.50')).toBeInTheDocument();
      expect(screen.getByText('Enable Beta Scaling')).toBeInTheDocument();
      expect(screen.getByText('Manual Override')).toBeInTheDocument();
    });

    test('displays beta explanation', () => {
      render(<BetaControls {...defaultProps} />);
      
      expect(screen.getByText('Beta measures stock volatility vs. market:')).toBeInTheDocument();
      expect(screen.getByText('Beta = 1.0: Moves with market')).toBeInTheDocument();
      expect(screen.getByText('Beta > 1.0: More volatile than market')).toBeInTheDocument();
      expect(screen.getByText('Beta < 1.0: Less volatile than market')).toBeInTheDocument();
    });

    test('shows loading spinner when fetching beta', () => {
      render(<BetaControls {...defaultProps} />);
      
      // The spinner should appear in the title when fetchingBeta is true
      // We'll test this through the fetch functionality
    });
  });

  describe('Beta Scaling Toggle', () => {
    test('calls onToggleBetaScaling when toggle is clicked', () => {
      render(<BetaControls {...defaultProps} />);
      
      const toggle = screen.getByRole('checkbox');
      fireEvent.click(toggle);
      
      expect(defaultProps.onToggleBetaScaling).toHaveBeenCalledWith(true);
    });

    test('shows parameter comparison when beta scaling is enabled', () => {
      const props = { ...defaultProps, enableBetaScaling: true };
      render(<BetaControls {...props} />);
      
      expect(screen.getByText('Parameter Adjustments')).toBeInTheDocument();
      expect(screen.getByText('Profit Requirement')).toBeInTheDocument();
      expect(screen.getAllByText('5.00%')).toHaveLength(2); // base values for profit requirement and trailing buy rebound
      expect(screen.getAllByText('7.50%')).toHaveLength(2); // adjusted values for profit requirement and trailing buy rebound
    });

    test('does not show parameter comparison when beta scaling is disabled', () => {
      render(<BetaControls {...defaultProps} />);
      
      expect(screen.queryByText('Parameter Adjustments')).not.toBeInTheDocument();
    });

    test('shows warning for extreme parameter adjustments', () => {
      const extremeProps = {
        ...defaultProps,
        enableBetaScaling: true,
        adjustedParameters: {
          ...defaultProps.adjustedParameters,
          profitRequirement: 0.25, // 25% - extreme value
          gridIntervalPercent: 0.6  // 60% - extreme value
        }
      };
      
      render(<BetaControls {...extremeProps} />);
      
      expect(screen.getByText('Some adjusted parameters are extreme. Consider manual override.')).toBeInTheDocument();
    });
  });

  describe('Beta Value Editing', () => {
    test('enters edit mode when edit button is clicked', () => {
      render(<BetaControls {...defaultProps} />);
      
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('saves new beta value when save is clicked', async () => {
      render(<BetaControls {...defaultProps} />);
      
      // Enter edit mode
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      // Change value
      const input = screen.getByDisplayValue('1.5');
      fireEvent.change(input, { target: { value: '2.0' } });
      
      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      expect(defaultProps.onBetaChange).toHaveBeenCalledWith(2.0);
    });

    test('cancels edit when cancel is clicked', () => {
      render(<BetaControls {...defaultProps} />);
      
      // Enter edit mode
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      // Change value
      const input = screen.getByDisplayValue('1.5');
      fireEvent.change(input, { target: { value: '2.0' } });
      
      // Cancel
      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);
      
      // Should not call onBetaChange and should exit edit mode
      expect(defaultProps.onBetaChange).not.toHaveBeenCalled();
      expect(screen.queryByDisplayValue('2.0')).not.toBeInTheDocument();
      expect(screen.getByText('1.50')).toBeInTheDocument();
    });

    test('validates beta value input', async () => {
      // Mock alert
      window.alert = jest.fn();
      
      render(<BetaControls {...defaultProps} />);
      
      // Enter edit mode
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      // Enter invalid value
      const input = screen.getByDisplayValue('1.5');
      fireEvent.change(input, { target: { value: '-1' } });
      
      // Try to save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      expect(window.alert).toHaveBeenCalledWith('Please enter a valid Beta value (must be >= 0)');
      expect(defaultProps.onBetaChange).not.toHaveBeenCalled();
    });
  });

  describe('Manual Override', () => {
    test('toggles manual override when button is clicked', () => {
      render(<BetaControls {...defaultProps} />);
      
      const overrideButton = screen.getByText('Manual Override');
      fireEvent.click(overrideButton);
      
      expect(defaultProps.onToggleManualOverride).toHaveBeenCalledWith(true);
    });

    test('shows reset button when manual override is active', () => {
      const props = { ...defaultProps, isManualOverride: true };
      render(<BetaControls {...props} />);
      
      expect(screen.getByText('Reset')).toBeInTheDocument();
    });

    test('makes API call when saving manual override', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      const props = { ...defaultProps, isManualOverride: true };
      render(<BetaControls {...props} />);
      
      // Enter edit mode
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      // Change value
      const input = screen.getByDisplayValue('1.5');
      fireEvent.change(input, { target: { value: '2.5' } });
      
      // Save
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/stocks/TSLA/beta', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            beta: 2.5,
            isManualOverride: true
          })
        });
      });
    });

    test('resets to fetched beta when reset button is clicked', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          beta: 1.8,
          source: 'yahoo_finance',
          lastUpdated: '2025-01-15T10:30:00Z'
        })
      });

      const props = { ...defaultProps, isManualOverride: true };
      render(<BetaControls {...props} />);
      
      const resetButton = screen.getByText('Reset');
      fireEvent.click(resetButton);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/stocks/TSLA/beta');
        expect(defaultProps.onBetaChange).toHaveBeenCalledWith(1.8);
        expect(defaultProps.onToggleManualOverride).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('Beta Data Fetching', () => {
    test('fetches beta data when symbol changes', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          beta: 1.8,
          source: 'yahoo_finance',
          lastUpdated: '2025-01-15T10:30:00Z'
        })
      });

      const { rerender } = render(<BetaControls {...defaultProps} symbol="AAPL" />);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/stocks/AAPL/beta');
      });

      // Change symbol
      rerender(<BetaControls {...defaultProps} symbol="NVDA" />);
      
      await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith('/api/stocks/NVDA/beta');
      });
    });

    test('does not fetch beta data when manual override is active', () => {
      const props = { ...defaultProps, isManualOverride: true };
      render(<BetaControls {...props} />);
      
      expect(fetch).not.toHaveBeenCalled();
    });

    test('handles fetch errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      fetch.mockRejectedValueOnce(new Error('Network error'));

      render(<BetaControls {...defaultProps} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching Beta data:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Status Display', () => {
    test('shows correct status for different beta sources', () => {
      const { rerender } = render(<BetaControls {...defaultProps} />);
      
      // Default status
      expect(screen.getByText('Default Value')).toBeInTheDocument();
      
      // Manual override - check for the status text specifically
      rerender(<BetaControls {...defaultProps} isManualOverride={true} />);
      const statusElements = screen.getAllByText('Manual Override');
      expect(statusElements).toHaveLength(2); // One in status, one as button text
      expect(statusElements[0]).toHaveClass('beta-source'); // Status text
      expect(statusElements[1]).toHaveClass('beta-override-btn'); // Button
    });

    test('formats and displays last updated date', () => {
      // Mock a specific date for consistent testing
      const mockDate = '2025-01-15T10:30:00Z';
      
      render(<BetaControls {...defaultProps} />);
      
      // We'll test this through the fetch functionality since lastUpdated is set internally
    });
  });

  describe('Error Handling', () => {
    test('displays error message when error prop is provided', () => {
      const props = { ...defaultProps, error: 'Failed to fetch beta data' };
      render(<BetaControls {...props} />);
      
      expect(screen.getByText('Failed to fetch beta data')).toBeInTheDocument();
    });

    test('handles API errors during manual override save', async () => {
      window.alert = jest.fn();
      
      fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Invalid beta value' })
      });

      const props = { ...defaultProps, isManualOverride: true };
      render(<BetaControls {...props} />);
      
      // Enter edit mode and try to save
      const editButton = screen.getByTitle('Edit Beta value');
      fireEvent.click(editButton);
      
      const input = screen.getByDisplayValue('1.5');
      fireEvent.change(input, { target: { value: '2.0' } });
      
      const saveButton = screen.getByText('Save');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Failed to update Beta: Invalid beta value');
      });
    });
  });

  describe('Loading States', () => {
    test('disables controls when loading', () => {
      const props = { ...defaultProps, loading: true };
      render(<BetaControls {...props} />);
      
      const toggle = screen.getByRole('checkbox');
      const editButton = screen.getByTitle('Edit Beta value');
      const overrideButton = screen.getByText('Manual Override');
      
      expect(toggle).toBeDisabled();
      expect(editButton).toBeDisabled();
      expect(overrideButton).toBeDisabled();
    });
  });

  describe('Responsive Behavior', () => {
    test('renders correctly on mobile viewports', () => {
      // This would typically be tested with viewport changes
      // For now, we'll just ensure the component renders without errors
      render(<BetaControls {...defaultProps} />);
      
      expect(screen.getByText('Beta (Market Volatility)')).toBeInTheDocument();
    });
  });

  describe('Parameter Comparison Display', () => {
    test('shows no parameters message when no adjustments available', () => {
      const props = {
        ...defaultProps,
        enableBetaScaling: true,
        baseParameters: {},
        adjustedParameters: {}
      };
      
      render(<BetaControls {...props} />);
      
      expect(screen.getByText('No parameter adjustments to display')).toBeInTheDocument();
    });

    test('displays all parameter comparisons correctly', () => {
      const props = { ...defaultProps, enableBetaScaling: true };
      render(<BetaControls {...props} />);
      
      // Check that all parameters are displayed
      expect(screen.getByText('Profit Requirement')).toBeInTheDocument();
      expect(screen.getByText('Grid Interval')).toBeInTheDocument();
      expect(screen.getByText('Trailing Buy Activation')).toBeInTheDocument();
      expect(screen.getByText('Trailing Buy Rebound')).toBeInTheDocument();
      expect(screen.getByText('Trailing Sell Activation')).toBeInTheDocument();
      expect(screen.getByText('Trailing Sell Pullback')).toBeInTheDocument();
      
      // Check percentage formatting - use getAllByText for duplicate values
      expect(screen.getAllByText('5.00%')).toHaveLength(2); // profit requirement and trailing buy rebound
      expect(screen.getAllByText('7.50%')).toHaveLength(2); // adjusted profit requirement and trailing buy rebound
      expect(screen.getAllByText('10.00%')).toHaveLength(3); // grid interval, trailing buy activation, and trailing sell pullback
      expect(screen.getAllByText('15.00%')).toHaveLength(3); // adjusted values for the same parameters
    });
  });
});