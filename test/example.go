
	package main
	import "fmt"
	// Definition for a binary tree node.
type TreeNode struct {
    Val   int
    Left  *TreeNode
    Right *TreeNode
}

// SolveTreeBFSWithLimit builds a BST from a slice and returns BFS levels 
// up to the specified maxDepth limit (1-indexed).
func SolveTreeBFSWithLimit(maxDepth int, nums []int) [][]int {
    var result [][]int
    if len(nums) == 0 || maxDepth <= 0 {
        return result
    }

    // 1. DYNAMICALLY BUILD THE BST INLINE
    var root *TreeNode
    for _, val := range nums {
        if root == nil {
            root = &TreeNode{Val: val}
            continue
        }
        current := root
        for {
            if val < current.Val {
                if current.Left == nil {
                    current.Left = &TreeNode{Val: val}
                    break
                }
                current = current.Left
            } else {
                if current.Right == nil {
                    current.Right = &TreeNode{Val: val}
                    break
                }
                current = current.Right
            }
        }
    }

    // 2. RUN INLINE BFS TRAVERSAL (Stopped by the maxDepth integer)
    queue := []*TreeNode{root}
    currentDepth := 0

    for len(queue) > 0 && currentDepth < maxDepth {
        levelSize := len(queue)
        var currentLevel []int

        for i := 0; i < levelSize; i++ {
            node := queue[0]
            queue = queue[1:]

            currentLevel = append(currentLevel, node.Val)

            if node.Left != nil {
                queue = append(queue, node.Left)
            }
            if node.Right != nil {
                queue = append(queue, node.Right)
            }
        }
        
        result = append(result, currentLevel)
        currentDepth++
    }

    return result
}


	func main() {
		maxDepth := 5
nums := []int{1,2,3,4,5,6,7,8,10}
			result0 := SolveTreeBFSWithLimit(maxDepth, nums)
			fmt.Println(result0)
	}