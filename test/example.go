package main

import "fmt"

func climbStairs(n int) int {
	if n <= 1 {
		return 1
	}

	dp := make([]int, n+1)
	dp[0] = 1
	dp[1] = 1

	for i := 2; i <= n; i++ {
		dp[i] = dp[i-1] + dp[i-2]
	}

	return dp[n]
}

func main() {
	n := 5
	result := climbStairs(n)
	fmt.Println("Ways to climb", n, "stairs:", result)
}
