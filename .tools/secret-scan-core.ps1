#Requires -Version 5.1

function Get-SecretPatternDefinitions {
    return @(
        [pscustomobject]@{ id = 'openai_key'; regex = 'sk-[A-Za-z0-9]{20,}' },
        [pscustomobject]@{ id = 'github_classic_pat'; regex = 'ghp_[A-Za-z0-9]{30,}' },
        [pscustomobject]@{ id = 'github_oauth'; regex = 'gho_[A-Za-z0-9]{30,}' },
        [pscustomobject]@{ id = 'github_fine_grained_pat'; regex = 'github_pat_[A-Za-z0-9_]{20,}' },
        [pscustomobject]@{ id = 'huggingface_token'; regex = 'hf_[A-Za-z0-9]{30,}' },
        [pscustomobject]@{ id = 'google_api_key'; regex = 'AIza[0-9A-Za-z\-_]{35}' },
        [pscustomobject]@{ id = 'private_key'; regex = ('-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )*PRIVATE KEY-----|-----BEGIN PGP ' + 'PRIVATE KEY BLOCK-----') },
        [pscustomobject]@{ id = 'assigned_api_key'; regex = '(?i)api[_-]?key\s*[:=]\s*["''][^"''\s]{16,}["'']' },
        [pscustomobject]@{ id = 'assigned_secret'; regex = '(?i)secret\s*[:=]\s*["''][^"''\s]{16,}["'']' },
        [pscustomobject]@{ id = 'assigned_token'; regex = '(?i)token\s*[:=]\s*["''][^"''\s]{16,}["'']' }
    )
}
