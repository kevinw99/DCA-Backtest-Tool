import math

def generate_sequence(n, start=0.0, firstDelta=0.05, end=0.7, ith=None):
    """
    Generate a monotonically increasing sequence with:
    - a0 = start
    - a(n-1) = end
    - If firstDelta is provided, a1 = start + firstDelta
    - Absolute increments increase
    - Relative increments decrease

    Parameters:
    n : int
        Length of the sequence (must be >= 3)
    start : float
        First value (default 0.0)
    firstDelta : float or None
        First increment (a1 - a0). If None, use natural quadratic scaling.
    end : float
        Last value (default 0.7)
    ith : int or None
        If specified, return (value, delta) for that index.
        Otherwise, return the full sequence.
    """
    if n < 3:
        raise ValueError("Sequence length must be at least 3")

    if firstDelta is None:
        # Use natural quadratic scaling when firstDelta is not specified
        sequence = []
        for i in range(n):
            # Quadratic progression from start to end
            t = i / (n - 1)  # normalized position [0, 1]
            value = start + (end - start) * (t ** 2)
            sequence.append(value)
    else:
        # When firstDelta is specified, calculate second value
        second = start + firstDelta

        # We need to solve for the quadratic curve
        # that passes through (0, start), (1, second), and (n-1, end)

        # We'll use a quadratic function: f(x) = ax² + bx + c
        # With constraints:
        # f(0) = start  ->  c = start
        # f(1) = second  ->  a + b + c = second
        # f(n-1) = end  ->  a(n-1)² + b(n-1) + c = end

        c = start
        # From f(1) = second: a + b = second - start = firstDelta
        # From f(n-1) = end: a(n-1)² + b(n-1) = end - start

        # Solving the system:
        # a + b = firstDelta
        # a(n-1)² + b(n-1) = end - start

        # From first equation: b = firstDelta - a
        # Substitute into second: a(n-1)² + (firstDelta - a)(n-1) = end - start
        # a(n-1)² + firstDelta(n-1) - a(n-1) = end - start
        # a((n-1)² - (n-1)) = end - start - firstDelta(n-1)
        # a(n-1)(n-2) = end - start - firstDelta(n-1)

        denominator = (n-1) * (n-2)
        if denominator == 0:
            # Special case for n=2, use linear interpolation
            a = 0
            b = firstDelta
        else:
            a = (end - start - firstDelta * (n-1)) / denominator
            b = firstDelta - a

        sequence = []
        for i in range(n):
            value = a * (i ** 2) + b * i + c
            sequence.append(value)

    # Ensure the sequence satisfies our constraints
    sequence[0] = start
    sequence[-1] = end
    if firstDelta is not None and n > 1:
        sequence[1] = start + firstDelta

    # If ith is specified, return value and delta for that index
    if ith is not None:
        if ith < 0 or ith >= n:
            raise ValueError(f"Index {ith} is out of bounds for sequence of length {n}")

        value = sequence[ith]
        if ith == 0:
            delta = 0  # No previous value
        else:
            delta = sequence[ith] - sequence[ith-1]

        return (value, delta)

    return sequence

# Test the function with the requested parameters
if __name__ == "__main__":
    print("Test 1: generate_sequence(10, start=0.0, firstDelta=0.05, end=0.7, ith=None)")
    seq1 = generate_sequence(10, start=0.0, firstDelta=0.05, end=0.7, ith=None)
    print("Sequence:", [f"{x:.4f}" for x in seq1])

    # Show absolute and relative increments
    print("\nAbsolute increments:")
    abs_increments = []
    for i in range(1, len(seq1)):
        delta = seq1[i] - seq1[i-1]
        abs_increments.append(delta)
        print(f"  Δ{i} = {delta:.4f}")

    print("\nRelative increments (%):")
    for i in range(1, len(seq1)):
        delta = seq1[i] - seq1[i-1]
        if seq1[i-1] == 0:
            print(f"  Δ{i}% = undefined (division by zero)")
        else:
            rel_increment = (delta / seq1[i-1]) * 100
            print(f"  Δ{i}% = {rel_increment:.2f}%")

    print("\n" + "="*50)

    print("Test 2: generate_sequence(7, start=0.0, second=0.1, end=0.7, ith=None)")
    seq2 = generate_sequence(7, start=0.0, second=0.1, end=0.7, ith=None)
    print("Sequence:", [f"{x:.4f}" for x in seq2])

    # Show absolute and relative increments
    print("\nAbsolute increments:")
    abs_increments = []
    for i in range(1, len(seq2)):
        delta = seq2[i] - seq2[i-1]
        abs_increments.append(delta)
        print(f"  Δ{i} = {delta:.4f}")

    print("\nRelative increments (%):")
    for i in range(1, len(seq2)):
        delta = seq2[i] - seq2[i-1]
        if seq2[i-1] == 0:
            print(f"  Δ{i}% = undefined (division by zero)")
        else:
            rel_increment = (delta / seq2[i-1]) * 100
            print(f"  Δ{i}% = {rel_increment:.2f}%")