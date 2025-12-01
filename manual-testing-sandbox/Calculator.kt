class Calculator {
    private var result: Double = 0.0

    /**
     * Adds a number to the current result
     */
    fun add(number: Double): Calculator {
        result += number
        return this
    }

    /**
     * Subtracts a number from the current result
     */
    fun subtract(number: Double): Calculator {
        result -= number
        return this
    }

    /**
     * Multiplies the current result by a number
     */
    fun multiply(number: Double): Calculator {
        result *= number
        return this
    }

    /**
     * Divides the current result by a number
     * @throws ArithmeticException if dividing by zero
     */
    fun divide(number: Double): Calculator {
        if (number == 0.0) {
            throw ArithmeticException("Division by zero")
        }
        result /= number
        return this
    }

    /**
     * Raises the current result to the power of a number
     */
    fun power(number: Double): Calculator {
        result = kotlin.math.pow(result, number)
        return this
    }

    /**
     * Calculates the square root of the current result
     * @throws ArithmeticException if the result is negative
     */
    fun sqrt(): Calculator {
        if (result < 0) {
            throw ArithmeticException("Cannot calculate square root of negative number")
        }
        result = kotlin.math.sqrt(result)
        return this
    }

    /**
     * Returns the current result
     */
    fun getResult(): Double = result

    /**
     * Resets the calculator to zero
     */
    fun reset(): Calculator {
        result = 0.0
        return this
    }

    /**
     * Sets the result to a specific value
     */
    fun setResult(value: Double): Calculator {
        result = value
        return this
    }
}