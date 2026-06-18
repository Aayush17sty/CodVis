package main

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func getCurrent(c *gin.Context, session *Session) {
	c.JSON(http.StatusOK, session.Snapshots[session.Current])
}

func next(c *gin.Context, session *Session) {
	if session.Current < len(session.Snapshots)-1 {
		session.Current++
	}
	c.JSON(http.StatusOK, session.Snapshots[session.Current])
}

func prev(c *gin.Context, session *Session) {
	if session.Current > 0 {
		session.Current--
	}
	c.JSON(http.StatusOK, session.Snapshots[session.Current])
}

func jump(c *gin.Context, session *Session) {
	indexStr := c.Param("index")
	index, err := strconv.Atoi(indexStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid index"})
		return
	}
	if index >= 0 && index < len(session.Snapshots) {
		session.Current = index
	}
	c.JSON(http.StatusOK, session.Snapshots[session.Current])
}
