
	package main
	import "fmt"
	func climbStairs(n int, s string) (int, bool) {
	if n <= 1 {
		return 1, true
	}
	dp := make([]int, n+1)
	dp[0] = 1
	dp[1] = 1
	for i := 2; i <= n; i++ {
		dp[i] = dp[i-1] + dp[i-2]
	}
	fmt.Println(s)
	return dp[n], true
}
	func main() {
		n := 5
s := "hey"
			result0, result1 := climbStairs(n, s)
			fmt.Println(result0)
	fmt.Println(result1)
	}