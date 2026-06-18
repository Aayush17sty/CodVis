package main

import (
	"log"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/go-delve/delve/service/api"
	"github.com/go-delve/delve/service/rpc2"
)

func main() {
	fileBytes, err := os.ReadFile("/home/asty/test/example.go")
	if err != nil {
		log.Fatal(err)
	}
	userFunction := string(fileBytes)
	Wrapper(userFunction)
	fullFile := BuildMainFunction(ScanInput(), userFunction)
	os.MkdirAll("/home/asty/CodVis/test", 0755)
	os.WriteFile("/home/asty/CodVis/test/example.go", []byte(fullFile), 0644)
	cmd := exec.Command("dlv", "debug", "--headless",
		"--api-version=2",
		"--listen=127.0.0.1:4040",
		"/home/asty/CodVis/test/example.go",
	)
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

	<-client.Continue()
	var Snapshots []Snapshot
	var nextState *api.DebuggerState
	for {
		state, _ := client.GetState()
		line := state.CurrentThread.Line
		funcName := state.CurrentThread.Function.Name()
		locals, _ := client.ListLocalVariables(
			api.EvalScope{GoroutineID: -1, Frame: 0},
			api.LoadConfig{
				FollowPointers:     true,
				MaxVariableRecurse: 3,
				MaxStringLen:       512,
				MaxArrayValues:     100,
				MaxStructFields:    50,
			},
		)
		frames, _ := client.Stacktrace(-1, 10, 0, 0, nil)
		snap := Snapshot{Line: line}
		for _, v := range locals {
			variable := Variable{
				Name:  v.Name,
				Value: v.Value,
				Type:  v.Type,
			}
			for _, child := range v.Children {
				variable.Children = append(variable.Children, Variable{
					Name:  child.Name,
					Value: child.Value,
					Type:  child.Type,
				})
			}
			snap.Variables = append(snap.Variables, variable)
		}
		for _, f := range frames {
			snap.Callstack = append(snap.Callstack, f.Function.Name())
		}

		Snapshots = append(Snapshots, snap)
		if strings.HasPrefix(funcName, "main.") {
			nextState, _ = client.Step()
		} else {
			nextState, _ = client.StepOut()
		}
		if nextState.Exited {
			break
		}
	}
	Initiate(Snapshots)
}
