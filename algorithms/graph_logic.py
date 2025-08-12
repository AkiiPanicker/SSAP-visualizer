import heapq
import math

# --- Helper function to reconstruct graph from JSON ---
def build_adjacency_list(graph_data):
    # CORRECTED LINE: Ensure all keys in the adjacency list are strings from the start.
    adj = {str(node['id']): [] for node in graph_data['nodes']}
    
    for edge in graph_data['edges']:
        u, v = str(edge['from']), str(edge['to'])
        weight = int(edge['label'])
        
        # This will now work correctly as adj keys are strings.
        adj[u].append({'node': v, 'weight': weight})
        
        # If graph is undirected, add the reverse edge. This is assumed for Dijkstra/A*.
        # Note: Bellman-Ford might ideally work on a directed-only version.
        if not graph_data.get('directed', False):
             adj[v].append({'node': u, 'weight': weight})
    return adj

# --- Heuristic for A* ---
def heuristic(node1_pos, node2_pos):
    # Heuristic can return 0 if positions are missing
    if not node1_pos or not node2_pos:
        return 0
    return math.sqrt((node1_pos['x'] - node2_pos['x'])**2 + (node1_pos['y'] - node2_pos['y'])**2) / 100 # Scaled

# --- Path Reconstruction ---
def reconstruct_path(previous, start_node, end_node):
    path = []
    current_node = end_node
    while current_node is not None:
        path.append(current_node)
        current_node = previous.get(current_node)
    path.reverse()
    return path if path and path[0] == start_node else []

# --- Dijkstra's Algorithm ---
def dijkstra(graph_data, start_node, end_node):
    adj = build_adjacency_list(graph_data)
    nodes = {str(node['id']) for node in graph_data['nodes']}
    
    distances = {node: float('inf') for node in nodes}
    previous = {node: None for node in nodes}
    distances[start_node] = 0
    
    pq = [(0, start_node)]
    visited = set()
    steps = []
    
    steps.append({'type': 'init', 'distances': {n: '∞' for n in nodes}, 'start_node': start_node, 'message': 'Initialization: Set all distances to infinity, start node to 0.'})
    
    while pq:
        dist, current_node = heapq.heappop(pq)
        
        if current_node in visited:
            continue
        visited.add(current_node)
        
        steps.append({'type': 'visit', 'node': current_node, 'message': f'Visiting node {current_node}. Found shortest distance: {dist}.'})

        if current_node == end_node:
            break

        for edge in adj.get(current_node, []):
            neighbor = edge['node']
            weight = edge['weight']
            new_dist = dist + weight
            
            steps.append({'type': 'check_edge', 'from': current_node, 'to': neighbor, 'message': f'Checking neighbor {neighbor} of {current_node}.'})

            if new_dist < distances[neighbor]:
                distances[neighbor] = new_dist
                previous[neighbor] = current_node
                heapq.heappush(pq, (new_dist, neighbor))
                steps.append({
                    'type': 'update_dist',
                    'node': neighbor,
                    'new_dist': new_dist,
                    'from': current_node,
                    'message': f'Update: Found a shorter path to {neighbor} via {current_node}. New distance: {new_dist}.'
                })

    path = reconstruct_path(previous, start_node, end_node)
    total_cost = distances.get(end_node, 'N/A')
    steps.append({'type': 'final', 'path': path, 'cost': total_cost, 'nodes_visited': len(visited)})
    return steps

# --- A* Search ---
def a_star(graph_data, start_node, end_node):
    adj = build_adjacency_list(graph_data)
    node_positions = {str(node['id']): {'x': node.get('x',0), 'y': node.get('y',0)} for node in graph_data['nodes']}
    
    end_pos = node_positions[end_node]
    
    open_set = [(0 + heuristic(node_positions[start_node], end_pos), start_node)]
    
    g_scores = {str(node['id']): float('inf') for node in graph_data['nodes']}
    g_scores[start_node] = 0
    
    previous = {str(node['id']): None for node in graph_data['nodes']}
    visited_for_count = set()
    
    steps = [{'type': 'init', 'distances': {str(node['id']): '∞' for node in graph_data['nodes']}, 'start_node': start_node, 'message': 'Initialization for A*.'}]
    
    while open_set:
        _, current_node = heapq.heappop(open_set)

        if current_node in visited_for_count:
            continue
        visited_for_count.add(current_node)
        steps.append({'type': 'visit', 'node': current_node, 'message': f'Visiting node {current_node}.'})
        
        if current_node == end_node:
            path = reconstruct_path(previous, start_node, end_node)
            total_cost = g_scores.get(end_node, 'N/A')
            steps.append({'type': 'final', 'path': path, 'cost': total_cost, 'nodes_visited': len(visited_for_count)})
            return steps
        
        for edge in adj.get(current_node, []):
            neighbor = edge['node']
            weight = edge['weight']
            tentative_g_score = g_scores[current_node] + weight
            
            steps.append({'type': 'check_edge', 'from': current_node, 'to': neighbor, 'message': f'Checking neighbor {neighbor}.'})

            if tentative_g_score < g_scores.get(neighbor, float('inf')):
                previous[neighbor] = current_node
                g_scores[neighbor] = tentative_g_score
                f_score = tentative_g_score + heuristic(node_positions.get(neighbor), end_pos)
                heapq.heappush(open_set, (f_score, neighbor))
                
                steps.append({
                    'type': 'update_dist',
                    'node': neighbor,
                    'new_dist': tentative_g_score,
                    'h_score': heuristic(node_positions.get(neighbor), end_pos),
                    'f_score': f_score,
                    'from': current_node,
                    'message': f'Update for {neighbor}: g(n)={tentative_g_score:.1f}, f(n)={f_score:.1f}'
                })
                
    steps.append({'type': 'final', 'path': [], 'cost': 'Not Found', 'nodes_visited': len(visited_for_count)})
    return steps

# --- Bellman-Ford ---
def bellman_ford(graph_data, start_node, end_node):
    # This algorithm is designed for directed graphs. We build edges based on `from` and `to`.
    edges_list = []
    for edge in graph_data['edges']:
        edges_list.append((str(edge['from']), str(edge['to']), int(edge['label'])))
    
    nodes = {str(node['id']) for node in graph_data['nodes']}
    distances = {node: float('inf') for node in nodes}
    previous = {node: None for node in nodes}
    distances[start_node] = 0
    num_vertices = len(nodes)
    steps = []

    steps.append({'type': 'init', 'distances': {n: '∞' for n in nodes}, 'start_node': start_node, 'message': 'Initialization for Bellman-Ford.'})

    for i in range(num_vertices - 1):
        steps.append({'type': 'iteration', 'number': i + 1, 'message': f'--- Iteration {i+1} of {num_vertices-1} ---'})
        updated_in_iteration = False
        for u, v, w in edges_list:
            if distances.get(u, float('inf')) != float('inf') and distances[u] + w < distances.get(v, float('inf')):
                distances[v] = distances[u] + w
                previous[v] = u
                updated_in_iteration = True
                steps.append({
                    'type': 'update_dist', 'node': v, 'new_dist': distances[v], 'from': u, 'message': f'Relaxing edge ({u}->{v}): new distance for {v} is {distances[v]}.'
                })
        if not updated_in_iteration:
            break # Early exit optimization
    
    for u, v, w in edges_list:
        if distances.get(u, float('inf')) != float('inf') and distances[u] + w < distances.get(v, float('inf')):
            steps.append({'type': 'negative_cycle', 'message': 'Error: Negative weight cycle detected!'})
            return steps

    path = reconstruct_path(previous, start_node, end_node)
    total_cost = distances.get(end_node, 'N/A')
    steps.append({'type': 'final', 'path': path, 'cost': total_cost, 'nodes_visited': num_vertices})
    return steps
    
# --- Bidirectional Dijkstra ---
def bidirectional_dijkstra(graph_data, start_node, end_node):
    if start_node == end_node:
        return [{'type':'final', 'path': [start_node], 'cost':0, 'nodes_visited': 1}]

    steps = [{'type':'init', 'message': 'Init Bi-Dijkstra'}]
    adj = build_adjacency_list(graph_data)
    nodes = {str(node['id']) for node in graph_data['nodes']}
    
    dist_fwd, dist_bwd = {n: float('inf') for n in nodes}, {n: float('inf') for n in nodes}
    prev_fwd, prev_bwd = {n: None for n in nodes}, {n: None for n in nodes}
    
    dist_fwd[start_node] = 0
    dist_bwd[end_node] = 0
    
    pq_fwd, pq_bwd = [(0, start_node)], [(0, end_node)]
    visited_fwd, visited_bwd = set(), set()
    
    mu = float('inf')
    meet_node = None
    
    while pq_fwd and pq_bwd:
        # Optimization: stop when shortest paths from both searches are greater than best path found so far
        if pq_fwd[0][0] + pq_bwd[0][0] >= mu:
            break

        # Forward search step
        if len(pq_fwd) <= len(pq_bwd):
            dist, u = heapq.heappop(pq_fwd)
            if u in visited_fwd or dist > dist_fwd[u]: continue
            visited_fwd.add(u)
            steps.append({'type': 'visit', 'node': u, 'direction': 'fwd', 'message': f'Fwd search visiting {u}'})

            for edge in adj.get(u, []):
                v, w = edge['node'], edge['weight']
                if dist_fwd[u] + w < dist_bwd.get(v, float('inf')):
                    dist_fwd[v] = dist_fwd[u] + w
                    prev_fwd[v] = u
                    heapq.heappush(pq_fwd, (dist_fwd[v], v))
                    steps.append({'type': 'update_dist', 'node': v, 'new_dist': dist_fwd[v], 'from': u, 'direction': 'fwd'})

                    if v in visited_bwd and dist_fwd[v] + dist_bwd[v] < mu:
                        mu = dist_fwd[v] + dist_bwd[v]
                        meet_node = v
                        steps.append({'type': 'meet', 'node':v, 'cost': mu, 'message':f'New meeting point {v} found! Total path cost: {mu}'})
        # Backward search step
        else:
            dist, u = heapq.heappop(pq_bwd)
            if u in visited_bwd or dist > dist_bwd[u]: continue
            visited_bwd.add(u)
            steps.append({'type': 'visit', 'node': u, 'direction': 'bwd', 'message': f'Bwd search visiting {u}'})

            for edge in adj.get(u, []):
                v, w = edge['node'], edge['weight']
                if dist_bwd[u] + w < dist_bwd.get(v, float('inf')):
                    dist_bwd[v] = dist_bwd[u] + w
                    prev_bwd[v] = u
                    heapq.heappush(pq_bwd, (dist_bwd[v], v))
                    steps.append({'type': 'update_dist', 'node': v, 'new_dist': dist_bwd[v], 'from': u, 'direction': 'bwd'})

                    if v in visited_fwd and dist_fwd[v] + dist_bwd[v] < mu:
                        mu = dist_fwd[v] + dist_bwd[v]
                        meet_node = v
                        steps.append({'type': 'meet', 'node':v, 'cost': mu, 'message':f'New meeting point {v} found! Total path cost: {mu}'})

    path = []
    if meet_node:
        path = reconstruct_path(prev_fwd, start_node, meet_node)
        curr = prev_bwd.get(meet_node)
        while curr is not None:
            path.append(curr)
            curr = prev_bwd.get(curr)

    steps.append({'type': 'final', 'path': path, 'cost': mu if mu != float('inf') else 'N/A', 'nodes_visited': len(visited_fwd | visited_bwd)})
    return steps
