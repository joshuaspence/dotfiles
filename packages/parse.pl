#!/usr/bin/env perl

use strict;
use warnings;

################################################################################

use constant PACKAGE_FILE => "packages";

# Forward declarations
sub trim;
sub ltrim;
sub rtrim;
sub parse;
sub full_output;
sub list_output;

################################################################################

my $package_file = PACKAGE_FILE;

# Get command line options
use Getopt::Std;
use Getopt::Long;
Getopt::Long::Configure('bundling');
my $install_all;
GetOptions('a|install_all' => \$install_all);

my $all_packages = parse($package_file);
if ($install_all) {
    list_output($all_packages);
} else {
    full_output($all_packages);
}

exit 0;

# Parse the data
sub parse {
    my %all_packages = ();
    my $line;
    my $header = '';
    my $package_file = shift;
    
    # The argument should be the input file
    open FILE, "<", $package_file or die $!;
    
    while ($line = <FILE>) {
        chomp($line); # remove newline characters
        
        if ($line =~ m/^\s*$/) {
            next;
        } elsif ($line =~ m/^\s*\$/) {
            # This is a header
            ($header = $line) =~ s/\s*\$\s*//;
            
            # Initialise hash.
            $all_packages{$header} = ();                # new hash
            $all_packages{$header}{'subpackages'} = []; # new array
        } elsif ($line =~ m/^\s*#/ && $header !~ m/^$/) {
            # This is a comment
            (my $comment = $line) =~ s/^[^#]*(#\s*)?//;
            $all_packages{$header}{'comment'} = $comment;
        } elsif ($header !~ m/^$/) {
            # This is data
            (my $subpackage_name    = $line) =~ s/\s*#.*$//;
            (my $subpackage_comment = $line) =~ s/^[^#]*(#\s*)?//;
            
            my $subpackage_hash = {};
            $subpackage_hash->{'name'} = $subpackage_name;
            if ($subpackage_comment) {
                $subpackage_hash->{'comment'} = $subpackage_comment;
            }
            
            push($all_packages{$header}{'subpackages'},$subpackage_hash);
        }
    }
    
    close FILE or die $!;
    
    return \%all_packages;
}

sub full_output {
    my $all_packages = shift;

    # Loop through packages in alphabetical order
    for my $key (sort keys %$all_packages) {
        my $package_name = $key;
        my $package_comment = $all_packages->{$key}{'comment'};
        my $subpackages = $all_packages->{$key}{'subpackages'};
        
        print("Package name: $package_name\n");
        if ($package_comment) {
            print("Comment:      $package_comment\n");
        }
        print("Subpackages:\n");
        foreach my $subpackage (@$subpackages) {
            my $subpackage_name    = $subpackage->{'name'};
            my $subpackage_comment = $subpackage->{'comment'};
            
            if ($subpackage_comment) {
                print("\t$subpackage_name => $subpackage_comment\n");
            } else {
                print("\t$subpackage_name\n");
            }
        }
        print("\n");
    }
}

sub list_output {
    my $all_packages = shift;
    
    # Loop through packages in alphabetical order
    for my $key (sort keys $all_packages) {
        my $package_name = $key;
        my $package_comment = $all_packages->{$key}{'comment'};
        my $subpackages = $all_packages->{$key}{'subpackages'};
        
        foreach my $subpackage (@$subpackages) {
            my $subpackage_name    = $subpackage->{'name'};
            my $subpackage_comment = $subpackage->{'comment'};
            
            print("$subpackage_name\n");
        }
    }
}

# Perl trim function to remove whitespace from the start and end of the string
sub trim {
    my $string = shift;
    $string =~ s/^\s+//;
    $string =~ s/\s+$//;
    return $string;
}

# Left trim function to remove leading whitespace
sub ltrim {
    my $string = shift;
    $string =~ s/^\s+//;
    return $string;
}

# Right trim function to remove trailing whitespace
sub rtrim {
    my $string = shift;
    $string =~ s/\s+$//;
    return $string;
}
