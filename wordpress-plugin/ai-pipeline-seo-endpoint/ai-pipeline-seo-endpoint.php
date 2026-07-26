<?php
/**
 * Plugin Name: AI Pipeline SEO Endpoint
 * Plugin URI: https://github.com/
 * Description: Rank Math SEO metadata를 update_post_meta로 직접 저장하는 custom REST endpoint (content-pipeline Phase 2-13). 공개 게시(publish)는 절대 수행하지 않으며, 이 plugin은 post meta 갱신만 담당한다.
 * Version: 1.0.0
 * Author: content-pipeline
 * License: GPL-2.0-or-later
 * Text Domain: ai-pipeline-seo-endpoint
 *
 * 보안 원칙:
 * - 이 endpoint는 인증된(Application Password 등) 사용자만 호출할 수 있다.
 * - permission_callback은 '__return_true'를 사용하지 않는다 — 반드시
 *   current_user_can('edit_post', $post_id)로 대상 글에 대한 편집 권한을
 *   확인한다.
 * - Rank Math provider만 지원한다 (Yoast/AIOSEO는 이 plugin의 범위 밖).
 * - 이 plugin은 요청/응답에 Application Password나 Authorization header를
 *   포함하지 않으며, 별도로 로그를 남기지 않는다.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // 직접 접근 차단.
}

define( 'AI_PIPELINE_SEO_ENDPOINT_NAMESPACE', 'ai-pipeline/v1' );
define( 'AI_PIPELINE_SEO_ENDPOINT_ROUTE', '/seo-meta' );

/**
 * Rank Math가 사용하는 post meta key 매핑.
 * 이 plugin은 Rank Math 전용이다 — Yoast/AIOSEO는 지원하지 않는다.
 */
function ai_pipeline_seo_endpoint_get_rank_math_keys() {
	return array(
		'seoTitle'         => 'rank_math_title',
		'metaDescription'  => 'rank_math_description',
		'focusKeyword'     => 'rank_math_focus_keyword',
	);
}

/**
 * 요청 body에서 postId를 정수로 안전하게 추출한다 (없거나 유효하지 않으면 0).
 *
 * @param WP_REST_Request $request 요청 객체.
 * @return int
 */
function ai_pipeline_seo_endpoint_get_post_id_from_request( $request ) {
	$post_id = $request->get_param( 'postId' );
	if ( null === $post_id ) {
		return 0;
	}
	return absint( $post_id );
}

/**
 * permission_callback.
 *
 * is_user_logged_in()만으로 끝내지 않는다 — postId를 읽어 해당 글에 대한
 * edit_post 권한을 확인하고, provider가 rank_math인지, postId가 유효한지도
 * 함께 확인한다. 하나라도 실패하면 WP_Error를 반환해 요청을 거부한다.
 *
 * @param WP_REST_Request $request 요청 객체.
 * @return true|WP_Error
 */
function ai_pipeline_seo_endpoint_permission_callback( $request ) {
	if ( ! is_user_logged_in() ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_unauthorized',
			__( '인증이 필요합니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 401 )
		);
	}

	$post_id = ai_pipeline_seo_endpoint_get_post_id_from_request( $request );
	if ( $post_id <= 0 ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_invalid_post_id',
			__( 'postId가 유효하지 않습니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 400 )
		);
	}

	$provider = sanitize_key( (string) $request->get_param( 'provider' ) );
	if ( 'rank_math' !== $provider ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_provider_not_supported',
			__( '이 endpoint는 rank_math provider만 지원합니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 400 )
		);
	}

	$post = get_post( $post_id );
	if ( ! $post ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_post_not_found',
			__( '해당 post를 찾을 수 없습니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 404 )
		);
	}

	// 핵심 권한 검사: 요청자가 이 글을 편집할 권한이 있는지 확인한다.
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_forbidden',
			__( '이 글을 편집할 권한이 없습니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 403 )
		);
	}

	return true;
}

/**
 * REST route callback.
 *
 * 1. postId sanitize/validate
 * 2. provider === rank_math 확인
 * 3. post 존재 확인
 * 4. current_user_can('edit_post', postId) 재확인 (defense in depth)
 * 5. 입력값 sanitize
 * 6. update_post_meta 실행 (rank_math_title/description/focus_keyword)
 * 7. get_post_meta로 재조회해 검증
 * 8. safe response 반환 (요청/응답에 인증 정보를 포함하지 않는다)
 *
 * @param WP_REST_Request $request 요청 객체.
 * @return WP_REST_Response|WP_Error
 */
function ai_pipeline_seo_endpoint_callback( $request ) {
	$post_id = ai_pipeline_seo_endpoint_get_post_id_from_request( $request );

	$provider = sanitize_key( (string) $request->get_param( 'provider' ) );
	if ( 'rank_math' !== $provider ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_provider_not_supported',
			__( '이 endpoint는 rank_math provider만 지원합니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 400 )
		);
	}

	$post = get_post( $post_id );
	if ( ! $post ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_post_not_found',
			__( '해당 post를 찾을 수 없습니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 404 )
		);
	}

	// permission_callback에서 이미 확인했지만, 콜백 단계에서도 다시 확인한다
	// (defense in depth — 캐싱/훅 순서 문제로 우회되지 않도록).
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return new WP_Error(
			'ai_pipeline_seo_endpoint_forbidden',
			__( '이 글을 편집할 권한이 없습니다.', 'ai-pipeline-seo-endpoint' ),
			array( 'status' => 403 )
		);
	}

	$seo_title        = sanitize_text_field( (string) $request->get_param( 'seoTitle' ) );
	$meta_description = sanitize_textarea_field( (string) $request->get_param( 'metaDescription' ) );
	$focus_keyword    = sanitize_text_field( (string) $request->get_param( 'focusKeyword' ) );

	$secondary_keywords_raw = $request->get_param( 'secondaryKeywords' );
	$secondary_keywords     = array();
	if ( is_array( $secondary_keywords_raw ) ) {
		foreach ( $secondary_keywords_raw as $keyword ) {
			$sanitized = sanitize_text_field( (string) $keyword );
			if ( '' !== $sanitized ) {
				$secondary_keywords[] = $sanitized;
			}
		}
	}

	$updated_keys = array();
	$keys         = ai_pipeline_seo_endpoint_get_rank_math_keys();

	if ( '' !== $seo_title ) {
		update_post_meta( $post_id, $keys['seoTitle'], $seo_title );
		$updated_keys[] = $keys['seoTitle'];
	}
	if ( '' !== $meta_description ) {
		update_post_meta( $post_id, $keys['metaDescription'], $meta_description );
		$updated_keys[] = $keys['metaDescription'];
	}
	if ( '' !== $focus_keyword ) {
		// Rank Math는 secondary keyword를 focus keyword와 comma로 이어 저장한다.
		$focus_keyword_value = $focus_keyword;
		if ( ! empty( $secondary_keywords ) ) {
			$focus_keyword_value .= ',' . implode( ',', $secondary_keywords );
		}
		update_post_meta( $post_id, $keys['focusKeyword'], $focus_keyword_value );
		$updated_keys[] = $keys['focusKeyword'];
	}

	// 저장 후 다시 읽어 검증한다 (get_post_meta로 재조회).
	$verified = true;
	foreach ( $updated_keys as $key ) {
		$stored = get_post_meta( $post_id, $key, true );
		if ( '' === $stored || false === $stored ) {
			$verified = false;
			break;
		}
	}

	return new WP_REST_Response(
		array(
			'success'      => true,
			'postId'       => $post_id,
			'provider'     => 'rank_math',
			'updatedKeys'  => $updated_keys,
			'verified'     => $verified,
		),
		200
	);
}

/**
 * REST route를 등록한다. public 접근을 허용하지 않으며(permission_callback
 * 필수), '__return_true'를 사용하지 않는다.
 */
function ai_pipeline_seo_endpoint_register_routes() {
	register_rest_route(
		AI_PIPELINE_SEO_ENDPOINT_NAMESPACE,
		AI_PIPELINE_SEO_ENDPOINT_ROUTE,
		array(
			'methods'             => WP_REST_Server::CREATABLE, // POST
			'callback'            => 'ai_pipeline_seo_endpoint_callback',
			'permission_callback' => 'ai_pipeline_seo_endpoint_permission_callback',
			'args'                => array(
				'postId'            => array(
					'required' => true,
					'type'     => 'integer',
				),
				'provider'           => array(
					'required' => true,
					'type'     => 'string',
				),
				'seoTitle'           => array(
					'required' => false,
					'type'     => 'string',
				),
				'metaDescription'    => array(
					'required' => false,
					'type'     => 'string',
				),
				'focusKeyword'       => array(
					'required' => false,
					'type'     => 'string',
				),
				'secondaryKeywords'  => array(
					'required' => false,
					'type'     => 'array',
				),
			),
		)
	);
}
add_action( 'rest_api_init', 'ai_pipeline_seo_endpoint_register_routes' );
