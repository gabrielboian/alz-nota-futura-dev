import { authApi } from "@/lib/api";

export type ClientOption = {
  id: string;
  name: string;
};

export async function getClientData(): Promise<{
  user: {
    name: string;
  };
  clients: ClientOption[];
}> {
  const [currentUser, response] = await Promise.all([
    authApi.getCurrentUser(),
    {results: [
      { id: 1, label: "Client A - 123" },
      { id: 2, label: "Client B - 456" },
      { id: 3, label: "Client C - 789" },
    ]}
  ]);

  return {
    user: {
      name:
        currentUser?.first_name ||
        currentUser?.email ||
        "",
    },
    clients: response.results.map((client) => ({
      id: String(client.id),
      name: client.label.replace(/\s-\s\d+$/, "").trim(),
    })),
  };
}
