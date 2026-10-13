<?php
// ============================================================
// Signatories Helper — load from DB with fallback defaults
// ============================================================

function getSignatories(PDO $db): array {
    $defaults = [
        'sanitation_inspector' => ['person_name' => 'MARILOU F. SENDICO, RM',          'credentials' => 'Sanitation Inspector III',                        'signature_url' => ''],
        'city_health_officer'  => ['person_name' => 'ROMMEL R. SABIG, M.D.',            'credentials' => 'CGDH-I / City Health Officer',                    'signature_url' => ''],
        'city_mayor'           => ['person_name' => 'HON. REX R. JALANDOON, MD, MPM',   'credentials' => 'City Mayor',                                      'signature_url' => ''],
        'city_budget_officer'  => ['person_name' => 'MARLENE E. GARGANTIEL',            'credentials' => 'City Budget Officer / Acting City Administrator',  'signature_url' => ''],
        'collecting_officer'   => ['person_name' => '',                                  'credentials' => 'Collecting Officer',                              'signature_url' => ''],
    ];

    try {
        $stmt = $db->query('SELECT role_key, person_name, credentials, signature_url FROM document_signatories');
        $rows = $stmt->fetchAll();
        foreach ($rows as $r) {
            $defaults[$r['role_key']] = [
                'person_name'   => $r['person_name'],
                'credentials'   => $r['credentials'],
                'signature_url' => $r['signature_url'] ?? '',
            ];
        }
    } catch (Exception $e) {
        // Table may not exist yet — use defaults
    }

    return $defaults;
}
