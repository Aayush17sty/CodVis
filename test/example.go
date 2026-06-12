package main

import "fmt"

func climbStairs(n int, s string) int {
	if n <= 1 {
		return 1
	}

	dp := make([]int, n+1)
	dp[0] = 1
	dp[1] = 1

	for i := 2; i <= n; i++ {
		dp[i] = dp[i-1] + dp[i-2]
	}
	fmt.Println(s)
	return dp[n]
}

func main() {
	n := 5
	s := "Hello"
	result := climbStairs(n, s)
	fmt.Println("Ways to climb", n, "stairs:", result)
}
