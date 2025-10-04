# Requirements Document

## Introduction

Two critical issues need to be addressed: (1) The batch mode stock list needs fresh stock data and beta values to ensure accurate backtesting, and (2) When users disable Beta scaling, the parameters should revert to their original values instead of staying at beta-adjusted values, which causes confusion and incorrect backtesting.

## Requirements

### Requirement 1

**User Story:** As a user preparing for batch backtesting, I want all stocks in the batch list to have current data and beta values so that my backtests use accurate and up-to-date information.

#### Acceptance Criteria

1. WHEN I request data refresh for batch stocks THEN the system SHALL fetch fresh stock price data for all 16 symbols
2. WHEN stock data is updated THEN the system SHALL also refresh beta values from Yahoo Finance
3. WHEN data refresh completes THEN all stocks SHALL have current price data and beta values in the database
4. WHEN data fetching fails for any symbol THEN the system SHALL log errors but continue with other symbols
5. WHEN refresh is complete THEN the system SHALL provide a summary of updated stocks and any failures

### Requirement 2

**User Story:** As a user toggling Beta scaling on and off, I want parameters to revert to their original user-set values when I disable Beta scaling so that I can see my actual parameter preferences without beta adjustments.

#### Acceptance Criteria

1. WHEN I enable Beta scaling THEN the system SHALL store my current parameters as "base parameters" before applying beta adjustments
2. WHEN Beta scaling is enabled THEN displayed parameters SHALL show beta-adjusted values
3. WHEN I disable Beta scaling THEN parameters SHALL revert to the stored base parameters, not remain at beta-adjusted values
4. WHEN base parameters are restored THEN the form inputs SHALL immediately reflect the original user values
5. WHEN switching between enabled/disabled states THEN the parameter transitions SHALL be smooth and immediate

### Requirement 3

**User Story:** As a developer maintaining the system, I want robust base parameter management so that users never lose their original parameter settings when experimenting with Beta scaling.

#### Acceptance Criteria

1. WHEN base parameters are stored THEN they SHALL be preserved until Beta scaling is disabled
2. WHEN users change parameters while Beta scaling is disabled THEN those changes SHALL become the new base parameters
3. WHEN users change parameters while Beta scaling is enabled THEN the system SHALL update base parameters accordingly
4. WHEN localStorage is used THEN base parameters SHALL be persisted across browser sessions
5. WHEN parameter restoration occurs THEN it SHALL not trigger localStorage save loops

### Requirement 4

**User Story:** As a user, I want efficient data refresh operations so that updating multiple stocks doesn't take excessive time or cause system performance issues.

#### Acceptance Criteria

1. WHEN refreshing multiple stocks THEN operations SHALL run concurrently with appropriate rate limiting
2. WHEN data refresh is in progress THEN the system SHALL show progress indicators
3. WHEN refresh operations complete THEN the system SHALL provide detailed results and timing information
4. WHEN API rate limits are encountered THEN the system SHALL handle them gracefully with appropriate delays
5. WHEN refresh fails THEN the system SHALL provide clear error messages and retry options
