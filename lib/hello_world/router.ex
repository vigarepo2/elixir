defmodule HelloWorld.Router do
  use Plug.Router

  plug :match
  plug :dispatch

  get "/" do
    conn
    |> put_resp_content_type("text/html")
    |> send_resp(200, """
      <!DOCTYPE html>
      <html>
        <head><title>Hello World</title></head>
        <body>
          <h1>Hello World!</h1>
          <p>Welcome to my Elixir website on Gigalixir!</p>
        </body>
      </html>
    """)
  end

  match _ do
    send_resp(conn, 404, "Not Found")
  end
end
