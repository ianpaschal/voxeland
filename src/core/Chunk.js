// Terrarium is distributed under the MIT license.

// Globals
const CHUNK_SIZE = 16;
const BLOCK_COUNT = Math.pow( CHUNK_SIZE, 3 ); // 4096

import {
	Box3, Face3, Geometry, Mesh, MeshLambertMaterial,
	Vector2,
	Vector3, TextureLoader, NearestFilter,
	LinearMipMapLinearFilter
} from "three";
class Chunk {

	constructor( position, blockIndices ) {

		// Length is always 4096 (16 x 16 x 16)
		this.blockIndices = blockIndices;

		// Chunk coordinates:
		this.position = position;

		// Physical bounds within world
		this.bounds = new Box3( this.position, new Vector3(
			this.position.x + CHUNK_SIZE,
			this.position.y + CHUNK_SIZE,
			this.position.z + CHUNK_SIZE
		) );

		// this.mesh = new Object3D();
		this.generateGeometry();
		this.generateMaterials();
		this.mesh = new Mesh( this.geometry, this.materials );
	}

	/**
	 * Get the position of the block with the given index.
	 * @param {Number} i - Index of block
	 */
	getBlockLocation( i ) {
		if ( i < 0 || i >= BLOCK_COUNT ) {
			console.warn( "Block index out of bounds, cannot convert to location" );
			return null;
		}
		const x = Math.floor( i / Math.pow( CHUNK_SIZE, 2 ) );
		const y = Math.floor( ( i - x * Math.pow( CHUNK_SIZE, 2 ) ) / CHUNK_SIZE );
		const z = i % CHUNK_SIZE;
		return new Vector3( x, y, z );
	}

	/**
	 * Get the index of the block at the given position.
	 * @param {Vector3} vector - Vector within the chunk
	 */
	getBlockIndex( vector ) {
		// if ( this.bounds.containsPoint( vector ) === false ) {
		// 	console.warn( "Block vector out of bounds, cannot convert to index" );
		// 	return null;
		// }
		const x = vector.x * Math.pow( CHUNK_SIZE, 2 );
		const y = vector.y * CHUNK_SIZE;
		const z = vector.z;
		return x + y + z;
	}

	/**
	 * Get the index of the vertex at the given position.
	 * @param {Vector3} vector - Vector within the chunk
	 */
	getVertexIndex( vector ) {
		return this.geometry.vertices.find( ( vertex ) => {
			return vertex.equals( vector );
		});
	}

	generateMaterials() {
		this.materials = [];
		const loader = new TextureLoader();

		const grassSide = loader.load( "../resources/textures/grass_side.png" );
		grassSide.magFilter = NearestFilter;
		grassSide.minFilter = LinearMipMapLinearFilter;
		const grassTop = loader.load( "../resources/textures/grass_top.png" );
		grassTop.magFilter = NearestFilter;
		grassTop.minFilter = LinearMipMapLinearFilter;
		const dirt = loader.load( "../resources/textures/dirt.png" );
		dirt.magFilter = NearestFilter;
		dirt.minFilter = LinearMipMapLinearFilter;
		const cobbleStone = loader.load( "../resources/textures/cobble_stone.png" );
		cobbleStone.magFilter = NearestFilter;
		cobbleStone.minFilter = LinearMipMapLinearFilter;
		this.materials.push(
			new MeshLambertMaterial({
				color: 0xFFFFFF,
				map: grassSide
			}),
			new MeshLambertMaterial({
				color: 0xFFFFFF,
				map: grassTop
			}),
			new MeshLambertMaterial({
				color: 0xFFFFFF,
				map: dirt
			}),
			new MeshLambertMaterial({
				color: 0xFFFFFF,
				map: cobbleStone
			})
		);
		if ( this.mesh ) {
			this.mesh.materials = this.materials;
		}
	}

	/**
	 * Regenerate the chunk mesh (destroys existing and replaces).
	 */
	generateGeometry() {

		// Create an empty buffer geometry
		this.geometry = new Geometry();

		/*
			This is a more efficient way to generating chunk geometry. Originally,
			every single block was checked on all six sides, meaning the negative
			direction had already been checked. For this reason, we check only the
			blocks at x+1, y+1, and z+1. The exception is for edge blocks which must
			check adjacent chunks.
		*/

		// Use these for some DRY-loops
		const axes = [ "x", "y", "z" ];
		for ( let i = 0; i < BLOCK_COUNT; i++ ) {
			const location = this.getBlockLocation( i );
			axes.forEach( ( axis ) => {

				// Compute the neighbor location to check
				const direction = new Vector3();
				direction[ axis ] += 1;
				const checkLocation = location.clone().add( direction );

				// Must generate a face for east/north/top sides of the chunk
				if ( location[ axis ] === CHUNK_SIZE - 1 ) {
					if ( this.blockIndices[ i ] !== 0 ) {
						// Generate a face for that axis with positive normals
						this.generateFace( i, direction );
					}
					return;
				}

				// Must generate a face for west/south/bottom sides of the chunk
				if ( location[ axis ] === 0 && this.blockIndices[ i ] !== 0 ) {
					// Generate a face for that axis with negative normals
					this.generateFace( i, direction.clone().negate() );
				}

				// Perform logic checking if neighbor is solid or not
				const j = this.getBlockIndex( checkLocation );

				// If this block is solid and the neighbor is air, generate a face
				if ( this.blockIndices[ i ] !== 0 ) {
					if ( this.blockIndices[ j ] === 0 ) {
						// Generate a face for that axis with positive normals
						// Use block i but since the coordinates of block i are on the neg
						// corner (west/south/bottom)
						this.generateFace( i, direction );
					}
				} else {
					// Otherwise this block must be air, so check if the neigborh is solid
					if ( this.blockIndices[ j ] !== 0 ) {
						// Generate a face for that axis with negative normals
						this.generateFace( j, direction.clone().negate() );
					}
				}
			});
		}

		// Overwrite mesh (might already exist)
		if ( this.mesh ) {
			this.mesh.geometry = this.geometry;
			this.mesh.geometry.needsUpdate = true;
		}

	}

	generateFace( index, direction ) {
		const p = this.getBlockLocation( index );

		// Create four vertices

		/*
			Create them counter-clockwise (normal wrapping order)
			A, B, C; A, C, D
			B ----- A
			|    /  |
			|   /   |
			|  /    |
			C ----- D
		*/

		// NEW CODE
		const corners = computeVectors( p, direction );

		const indices = [];

		// Try to re-use existing vectors. If a vector with the right position
		// is found, use that, otherwise push the vector to the geometry and
		// use its index for the face
		corners.forEach( ( triplet ) => {
			const index = findIndexByVector( this.geometry, triplet );
			if ( index >= 0 ) {
				indices.push( index );
			} else {
				const length = this.geometry.vertices.push( triplet );
				indices.push( length - 1 );
			}
		});

		// Create the faces
		const faceA = new Face3( indices[ 0 ], indices[ 1 ], indices[ 2 ] );
		const faceB = new Face3( indices[ 0 ], indices[ 2 ], indices[ 3 ] );

		faceA.voxelPosition = this.getBlockLocation( index ).add( this.position );
		faceB.voxelPosition = this.getBlockLocation( index ).add( this.position );

		// Assign material
		switch( this.blockIndices[ index ] ) {
			// Grass
			case 1:
				if (
					direction.equals( new Vector3( 1, 0, 0 ) ) ||
					direction.equals( new Vector3( 0, 1, 0 ) ) ||
					direction.equals( new Vector3( -1, 0, 0 ) ) ||
					direction.equals( new Vector3( 0, -1, 0 ) )
				) {
					faceA.materialIndex = 0;
					faceB.materialIndex = 0;
				}

				if ( direction.equals( new Vector3( 0, 0, 1 ) ) ) {
					faceA.materialIndex = 1;
					faceB.materialIndex = 1;
				}
				if ( direction.equals( new Vector3( 0, 0, -1 ) ) ) {
					faceA.materialIndex = 2;
					faceB.materialIndex = 2;
				}
				break;
			case 2:
				faceA.materialIndex = 3;
				faceB.materialIndex = 3;
				break;
			default:
				faceA.materialIndex = 3;
				faceB.materialIndex = 3;
		}

		// Add the face to the geometry's faces array
		this.geometry.faces.push( faceA, faceB );
		this.geometry.faceVertexUvs.push( [] );
		this.geometry.faceVertexUvs[ 0 ].push( [
			new Vector2( 0, 1 ),
			new Vector2( 1, 1 ),
			new Vector2( 1, 0 )
		] );
		this.geometry.faceVertexUvs[ 0 ].push( [
			new Vector2( 0, 1 ),
			new Vector2( 1, 0 ),
			new Vector2( 0, 0 )
		] );
		this.geometry.computeFaceNormals();
	}

	/**
	 * Set a new value for a block at a given index, and update the mesh around
	 * around that block.
	 * @param {Number} i
	 * @param {Number} value
	 */
	setVoxelData( i, value ) {
		this.blockIndices[ i ] = value;
	}
}

export default Chunk;

/*
Chunk testing
const x = 7;
const y = 12;
const z = 2;
const i = x * 256 + y * 16 + z;

console.log( "x:" + x + ", y:" + y + ", z:" + z + " ->", i );

const compX = Math.floor( i / 256 );
const compY = Math.floor(( i - compX * 256 ) / 16);
const compZ = i % 16;

console.log( "x:", compX );
console.log( "y:", compY );
console.log( "z:", compZ );
*/

/**
 *
 * @param {Geometry} geometry - The geometry to search through
 * @param {Vector3} location - The location to check
 * @returns {Number} - The index of the matching vertex
 */
function findIndexByVector( geometry, location ) {
	let vertex;

	// 'for' loop is used here for performance reasons
	for ( let i = 0, length = geometry.vertices.length; i < length; i++ ) {
		vertex = geometry.vertices[ i ];

		// The Three.js .equals() method is simply a triple comparison for x,y,z
		if ( vertex.equals( location ) ) {

			// Return the index (we already know the location of that vertex anyway)
			return geometry.vertices.indexOf( vertex );
		}
	}
	return -1;
}

/**
 * @description asdfasdf
 * @param {*} p
 * @param {*} d
 */
function computeVectors( p, d ) {

	// Since chunks use buffer geometry, so vectors should be an array of 12 floats
	const vectors = [];

	// "East"
	if ( d.x === 1 ) {
		vectors.push(
			p.x + 1, p.y + 1, p.z + 1,
			p.x + 1, p.y,     p.z + 1,
			p.x + 1, p.y,     p.z,
			p.x + 1, p.y + 1, p.z
		);
		return vectors;
	}

	// "North"
	if ( d.y === 1 ) {
		vectors.push(
			p.x,     p.y + 1, p.z + 1,
			p.x + 1, p.y + 1, p.z + 1,
			p.x + 1, p.y + 1, p.z,
			p.x,     p.y + 1, p.z
		);
		return vectors;
	}

	// "Up"
	if ( d.z === 1 ) {
		vectors.push(
			p.x + 1, p.y + 1, p.z + 1,
			p.x,     p.y + 1, p.z + 1,
			p.x,     p.y,     p.z + 1,
			p.x + 1, p.y,     p.z + 1
		);
		return vectors;
	}

	// "West"
	if ( d.x === -1 ) {
		vectors.push(
			p.x,     p.y,     p.z + 1,
			p.x,     p.y + 1, p.z + 1,
			p.x,     p.y + 1, p.z,
			p.x,     p.y,     p.z
		);
		return vectors;
	}

	// "South"
	if ( d.y === -1 ) {
		vectors.push(
			p.x + 1, p.y,     p.z + 1,
			p.x,     p.y,     p.z + 1,
			p.x,     p.y,     p.z,
			p.x + 1, p.y,     p.z
		);
		return vectors;
	}

	// "Bottom"
	if ( d.z === -1 ) {
		vectors.push(
			p.x,     p.y,     p.z,
			p.x,     p.y + 1, p.z,
			p.x + 1, p.y + 1, p.z,
			p.x + 1, p.y,     p.z
		);
		return vectors;
	}
}
