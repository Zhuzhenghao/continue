class Calculator {
    private var result: Double = 0.0

    fun add(number: Double): Calculator {
        result += number
        return this
    }

    fun subtract(number: Double): Calculator {
        result -= number
        return this
    }

    fun multiply(number: Double): Calculator {
        result *= number
        return this
    }

    fun divide(number: Double): Calculator {
        if (number != 0.0) {
            result /= number
        } else {
            throw ArithmeticException("Division by zero")
        }
        return this
    }

    fun power(number: Double): Calculator {
        result = kotlin.math.pow(result, number)
        return this
    }

    fun sqrt(): Calculator {
        if (result >= 0) {
            result = kotlin.math.sqrt(result)
        } else {
            throw ArithmeticException("Cannot calculate square root of negative number")
        }
        return this
    }

    fun getResult(): Double = result

    fun reset(): Calculator {
        result = 0.0
        return this
    }
