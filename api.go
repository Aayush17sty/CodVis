package main

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

func (app *application) mount() http.Handler {
	r := gin.Default()
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, "root.")
	})

	r.GET("/current", func(c *gin.Context) {
		getCurrent(c, app.session)
	})

	r.POST("/next", func(c *gin.Context) {
		next(c, app.session)
	})

	r.POST("/prev", func(c *gin.Context) {
		prev(c, app.session)
	})

	r.POST("/jump/:index", func(c *gin.Context) {
		jump(c, app.session)
	})

	return r
}

func (app *application) run(h http.Handler) error {
	srv := &http.Server{
		Addr:    app.config.addr,
		Handler: h,
	}
	log.Printf("The server has started at port %s", srv.Addr)
	return srv.ListenAndServe()

}

func Initiate(snapshots []Snapshot) {
	cfg := config{
		addr: ":8080",
		db:   dbconfig{},
	}
	api := application{
		config: cfg,
		session: &Session{
			Snapshots: snapshots,
			Current:   0,
		},
	}

	mux := api.mount()
	log.Fatal(api.run(mux))
}
