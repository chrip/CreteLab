# CreteLab - E2E Test Recipes for Release Verification

This document outlines the test scenarios used to verify the end-to-end calculation logic and plausibility checks of the CreteLab concrete calculator.

## 1. Baseline Standard Mix
**Goal**: Verify basic calculation flow.
- **Inputs**:
    - Mixqualität: Standard
    - Strength: C25/30
    - Exposure: XC2
    - Sieve Line: B32
    - Consistency: F3
    - Aggregate: Granit
    - Cement: CEM I 42.5 N
    - Vorhaltemaß: 3
- **Expected Outcome**: 
    - No plausibility warnings.
    - w/z ratio $\le 0.75$.
    - Cement $\ge 240$ kg/m³.

## 2. Severe Exposure (Frost/De-icing)
**Goal**: Verify that the most severe class governs and enforces strict limits.
- **Inputs**:
    - Strength: C30/37
    - Exposure: XC1 AND XF4 (XF4 must govern)
    - Sieve Line: B16
    - Consistency: F3
    - Aggregate: Betonsplitt
    - Cement: CEM I 42.5 N
- **Expected Outcome**:
    - Governing Class: XF4.
    - Max w/z: 0.50.
    - Min Cement: 320 kg/m³.
    - No plausibility warnings.

## 3. SCM & Equivalent w/z
**Goal**: Verify that Fly Ash and Silica Fume reduce cement while maintaining durability.
- **Inputs**:
    - Strength: C30/37
    - Exposure: XC4
    - Fly Ash: 15%
    - Silica Fume: 8%
    - Cement: CEM I 42.5 N
- **Expected Outcome**:
    - Cement content should be lower than a pure CEM I mix.
    - $(w/z)_{eq}$ should be $\le 0.60$.
    - Plausibility check should account for SCMs in the paste volume.

## 4. Plausibility: Strength Mismatch
**Goal**: Trigger warning when strength class is too low for the exposure.
- **Inputs**:
    - Strength: C20/25 (f_ck_cube = 25)
    - Exposure: XF4 (min_f_ck_cube = 30)
- **Expected Outcome**:
    - ⚠️ Warning: "Stärke C20/25 erfüllt möglicherweise nicht Mindestfestigkeiten für Expositionsklasse XF4."

## 5. Plausibility: Cement Content Violation
**Goal**: Trigger warning when calculated cement is below the exposure minimum.
- **Inputs**:
    - Exposure: XF4 (min_z = 320)
    - Force low cement: Use a very high w/z (if possible) or a very low water demand.
- **Expected Outcome**:
    - ⚠️ Warning: "Zementgehalt [X] kg/m³ ist unter Mindestwert 320 kg/m³ für XF4."

## 6. Plausibility: Fines Content (Mehlkorngehalt)
**Goal**: Trigger warning when fines exceed the limit.
- **Inputs**:
    - Exposure: XC1 (Limit $\approx 550$ kg/m³)
    - High Cement: CEM I 52.5 R
    - Sieve Line: A8 (very fine)
    - High SCMs: Max Fly Ash + Silica Fume
- **Expected Outcome**:
    - ⚠️ Warning: "Mehlkorngehalt [X] kg/m³ überschreitet Maximum [Y] kg/m³ für Expositionsklasse XC1."