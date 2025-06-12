import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		// Simple addition tool
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		// Calculator tool with multiple operations
		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add":
						result = a + b;
						break;
					case "subtract":
						result = a - b;
						break;
					case "multiply":
						result = a * b;
						break;
					case "divide":
						if (b === 0)
							return {
								content: [
									{
										type: "text",
										text: "Error: Cannot divide by zero",
									},
								],
							};
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);

		// Get basic Pokemon information with formatted output
		this.server.tool(
			"get_pokemon_info",
			{
				name: z.string().describe("The name or ID of the Pokemon to look up")
			},
			async ({ name }) => {
				try {
					const pokemonName = name.toLowerCase().trim();
					const response = await fetch(
						`https://pokeapi.co/api/v2/pokemon/${pokemonName}`
					);

					if (!response.ok) {
						return {
							content: [{
								type: "text",
								text: `Error: Pokemon "${name}" not found. Please check the spelling or try a different name.`
							}],
						};
					}

					const data = await response.json();

					const formattedInfo = [
						`**${(data as any).name.charAt(0).toUpperCase() + (data as any).name.slice(1)}** (#${(data as any).id})`,
						`**Height:** ${(data as any).height / 10} m`,
						`**Weight:** ${(data as any).weight / 10} kg`,
						`**Types:** ${(data as any).types.map((t: any) => t.type.name).join(', ')}`,
						`**Base Stats:**`,
						...(data as any).stats.map((stat: any) =>
							`  - ${stat.stat.name}: ${stat.base_stat}`
						),
						`**Abilities:** ${(data as any).abilities.map((a: any) => a.ability.name).join(', ')}`
					].join('\n');

					return {
						content: [{ type: "text", text: formattedInfo }],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `Error fetching Pokemon data: ${error instanceof Error ? error.message : 'Unknown error'}`
						}],
					};
				}
			}
		);

		// Get Pokemon by type
		this.server.tool(
			"get_pokemon_by_type",
			{
				type: z.string().describe("The Pokemon type to search for (e.g., fire, water, grass)")
			},
			async ({ type }) => {
				try {
					const pokemonType = type.toLowerCase().trim();
					const response = await fetch(
						`https://pokeapi.co/api/v2/type/${pokemonType}`
					);

					if (!response.ok) {
						return {
							content: [{
								type: "text",
								text: `Error: Type "${type}" not found. Valid types include fire, water, grass, electric, psychic, ice, dragon, dark, fairy, normal, fighting, poison, ground, flying, bug, rock, ghost, steel.`
							}],
						};
					}

					const data = await response.json();
					const pokemonList = (data as any).pokemon.slice(0, 20).map((p: any) => p.pokemon.name);

					const formattedList = [
						`**${type.charAt(0).toUpperCase() + type.slice(1)}-type Pokemon** (showing first 20):`,
						...pokemonList.map((name: string, index: number) =>
							`${index + 1}. ${name.charAt(0).toUpperCase() + name.slice(1)}`
						)
					].join('\n');

					return {
						content: [{ type: "text", text: formattedList }],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `Error fetching Pokemon type data: ${error instanceof Error ? error.message : 'Unknown error'}`
						}],
					};
				}
			}
		);

		// Get Pokemon evolution chain
		this.server.tool(
			"get_pokemon_evolution",
			{
				name: z.string().describe("The name or ID of the Pokemon to get evolution chain for")
			},
			async ({ name }) => {
				try {
					const pokemonName = name.toLowerCase().trim();

					// First get the Pokemon species
					const pokemonResponse = await fetch(
						`https://pokeapi.co/api/v2/pokemon/${pokemonName}`
					);

					if (!pokemonResponse.ok) {
						return {
							content: [{
								type: "text",
								text: `Error: Pokemon "${name}" not found.`
							}],
						};
					}

					const pokemonData = await pokemonResponse.json();
					const speciesResponse = await fetch((pokemonData as any).species.url);
					const speciesData = await speciesResponse.json();

					// Get evolution chain
					const evolutionResponse = await fetch((speciesData as any).evolution_chain.url);
					const evolutionData = await evolutionResponse.json();

					// Parse evolution chain
					const parseEvolutionChain = (chain: any): string[] => {
						const evolutions = [chain.species.name];
						if (chain.evolves_to && chain.evolves_to.length > 0) {
							chain.evolves_to.forEach((evolution: any) => {
								evolutions.push(...parseEvolutionChain(evolution));
							});
						}
						return evolutions;
					};

					const evolutionChain = parseEvolutionChain((evolutionData as any).chain);

					const formattedChain = [
						`**Evolution Chain for ${name.charAt(0).toUpperCase() + name.slice(1)}:**`,
						evolutionChain.map((pokemon, index) =>
							`${index + 1}. ${pokemon.charAt(0).toUpperCase() + pokemon.slice(1)}`
						).join(' → ')
					].join('\n');

					return {
						content: [{ type: "text", text: formattedChain }],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `Error fetching evolution data: ${error instanceof Error ? error.message : 'Unknown error'}`
						}],
					};
				}
			}
		);

		// Get Pokemon moves
		this.server.tool(
			"get_pokemon_moves",
			{
				name: z.string().describe("The name or ID of the Pokemon to get moves for"),
				limit: z.number().optional().describe("Maximum number of moves to return (default: 10)")
			},
			async ({ name, limit = 10 }) => {
				try {
					const pokemonName = name.toLowerCase().trim();
					const response = await fetch(
						`https://pokeapi.co/api/v2/pokemon/${pokemonName}`
					);

					if (!response.ok) {
						return {
							content: [{
								type: "text",
								text: `Error: Pokemon "${name}" not found.`
							}],
						};
					}

					const data = await response.json();
					const moves = (data as any).moves.slice(0, Math.max(1, Math.min(50, limit)));

					const formattedMoves = [
						`**Moves for ${name.charAt(0).toUpperCase() + name.slice(1)}** (showing ${moves.length} moves):`,
						...moves.map((move: any, index: number) =>
							`${index + 1}. ${move.move.name.replace('-', ' ')}`
						)
					].join('\n');

					return {
						content: [{ type: "text", text: formattedMoves }],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `Error fetching Pokemon moves: ${error instanceof Error ? error.message : 'Unknown error'}`
						}],
					};
				}
			}
		);

		// Get move details
		this.server.tool(
			"get_move_details",
			{
				name: z.string().describe("The name of the move to get details for")
			},
			async ({ name }) => {
				try {
					const moveName = name.toLowerCase().trim().replace(' ', '-');
					const response = await fetch(
						`https://pokeapi.co/api/v2/move/${moveName}`
					);

					if (!response.ok) {
						return {
							content: [{
								type: "text",
								text: `Error: Move "${name}" not found.`
							}],
						};
					}

					const data = await response.json();
					const description = (data as any).effect_entries.find((entry: any) => entry.language.name === 'en')?.effect || 'No description available';

					const formattedDetails = [
						`**${(data as any).name.replace('-', ' ').toUpperCase()}**`,
						`**Type:** ${(data as any).type.name}`,
						`**Power:** ${(data as any).power || 'N/A'}`,
						`**Accuracy:** ${(data as any).accuracy || 'N/A'}%`,
						`**PP:** ${(data as any).pp}`,
						`**Priority:** ${(data as any).priority}`,
						`**Damage Class:** ${(data as any).damage_class.name}`,
						`**Effect:** ${description.replace('[effect_chance]%', `${(data as any).effect_chance || 0}%`)}`
					].join('\n');

					return {
						content: [{ type: "text", text: formattedDetails }],
					};
				} catch (error) {
					return {
						content: [{
							type: "text",
							text: `Error fetching move details: ${error instanceof Error ? error.message : 'Unknown error'}`
						}],
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
