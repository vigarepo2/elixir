defmodule HelloWorld.Application do
  use Application

  def start(_type, _args) do
    children = [
      {Plug.Cowboy, scheme: :http, plug: HelloWorld.Router, options: [port: port()]}
    ]

    opts = [strategy: :one_for_one, name: HelloWorld.Supervisor]
    Supervisor.start_link(children, opts)
  end
  
  defp port do
    String.to_integer(System.get_env("PORT") || "4000")
  end
end
