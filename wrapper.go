package main

import (
	"bufio"
	"bytes"
	"fmt"
	"go/ast"
	"go/parser"
	"go/printer"
	"go/token"
	"log"
	"os"
	"strings"
)

var Wrap FunctionWrap
var Param Parameter
var Value Values

func typeToString(fset *token.FileSet, expr ast.Expr) string {
	var buf bytes.Buffer
	printer.Fprint(&buf, fset, expr)
	return buf.String()
}

func Wrapper(userFunction string) {
	src := fmt.Sprintf("package main\n%s", userFunction)
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		log.Fatal(err)
	}
	ast.Inspect(node, func(node ast.Node) bool {
		switch x := node.(type) {
		case *ast.FuncDecl:
			if x.Name.Name != "main" {
				Wrap.Name = x.Name.Name
				for _, param := range x.Type.Params.List {
					Param.Name = param.Names[0].Name
					typeStr := typeToString(fset, param.Type)
					Param.Type = typeStr
					Wrap.Parameters = append(Wrap.Parameters, Param)
				}
				for _, result := range x.Type.Results.List {
					typeStr := typeToString(fset, result.Type)
					Wrap.Output = append(Wrap.Output, typeStr)
				}
			}
		}
		return true
	})
	fmt.Println(Wrap)
}

func ConvertValues(x string, v string) {
	switch x {
	case "int":
		Value.Value = append(Value.Value, v)
	case "float64":
		Value.Value = append(Value.Value, v)
	case "string":
		Value.Value = append(Value.Value, fmt.Sprintf(`"%s"`, v))
	case "bool":
		Value.Value = append(Value.Value, v)
	case "[]int":
		parts := strings.Split(v, " ")
		Value.Value = append(Value.Value, fmt.Sprintf("[]int{%s}", strings.Join(parts, ", ")))
	case "[]string":
		parts := strings.Split(v, " ")
		for i, p := range parts {
			parts[i] = fmt.Sprintf(`"%s"`, p)
		}
		Value.Value = append(Value.Value, fmt.Sprintf("[]string{%s}", strings.Join(parts, ", ")))
	case "[]float64":
		parts := strings.Split(v, " ")
		Value.Value = append(Value.Value, fmt.Sprintf("[]float64{%s}", strings.Join(parts, ", ")))
	}
}
func ScanInput() []string {
	var s string
	var parameters []string
	scanner := bufio.NewScanner(os.Stdin)
	if scanner.Scan() {
		s = scanner.Text()
	}
	parameters = strings.Split(s, " ")
	return parameters
}

func BuildMainFunction(userInputs []string, UserFunction string) string {
	var declarations []string
	for i := range userInputs {
		ConvertValues(Wrap.Parameters[i].Type, userInputs[i])
	}
	for i, param := range Wrap.Parameters {
		fmt.Println(Value.Value[i])
		declarations = append(declarations, fmt.Sprintf("%s := %s", param.Name, Value.Value[i]))
	}
	var resultNames []string
	for i := range Wrap.Output {
		resultNames = append(resultNames, fmt.Sprintf("result%d", i))
	}
	var paramNames []string
	for _, param := range Wrap.Parameters {
		paramNames = append(paramNames, param.Name)
	}
	var functionCall string
	if len(resultNames) > 0 {
		functionCall = fmt.Sprintf("\t%s := %s(%s)",
			strings.Join(resultNames, ", "),
			Wrap.Name,
			strings.Join(paramNames, ", "),
		)
	} else {
		functionCall = fmt.Sprintf("\t%s(%s)",
			Wrap.Name,
			strings.Join(paramNames, ", "),
		)
	}
	var prints []string
	for _, result := range resultNames {
		prints = append(prints, fmt.Sprintf("\tfmt.Println(%s)", result))
	}
	fullFile := fmt.Sprintf(`
	package main
	import "fmt"
	%s
	func main() {
		%s
		%s
		%s
	}`,
		UserFunction,
		strings.Join(declarations, "\n"),
		functionCall,
		strings.Join(prints, "\n"),
	)
	return fullFile
}
