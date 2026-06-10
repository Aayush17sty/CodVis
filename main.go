package main

import (
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/go-delve/delve/service/api"
	"github.com/go-delve/delve/service/rpc2"
)

func main() {
	cmd := exec.Command("dlv", "debug", "--headless",
		"--api-version=2",
		"--listen=127.0.0.1:4040",
		"/home/asty/CodVis/test/example.go",
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Start()

	var client *rpc2.RPCClient
	for i := 0; i < 10; i++ {
		time.Sleep(500 * time.Millisecond)
		c := rpc2.NewClient("127.0.0.1:4040")
		if c != nil {
			client = c
			break
		}
	}
	if client == nil {
		log.Fatal("could not connect to delve after retries")
	}
	client.CreateBreakpoint(&api.Breakpoint{
		FunctionName: "main.main",
	})
	var snapshots []Snapshot

	for {
		state, _ := client.GetState()
		line := state.CurrentThread.Line
		locals, _ := client.ListLocalVariables(
			api.EvalScope{GoroutineID: -1, Frame: 0},
			api.LoadConfig{FollowPointers: true, MaxVariableRecurse: 3},
		)
		frames, _ := client.Stacktrace(-1, 10, 0, 0, nil)
		snap := Snapshot{Line: line}
		for _, v := range locals {
			snap.Variables = append(snap.Variables, Variable{
				Name:  v.Name,
				Value: v.Value,
				Type:  v.Type,
			})
		}
		for _, f := range frames {
			snap.Callstack = append(snap.Callstack, f.Function.Name())
		}

		snapshots = append(snapshots, snap)
		nextState, _ := client.Next()
		if nextState.Exited {
			break
		}
	}
}
